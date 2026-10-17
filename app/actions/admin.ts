"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { audit, runAction } from "@/lib/action";
import { inboxChanged } from "@/lib/activity";
import { ActionError, requirePermission } from "@/lib/auth";
import { clerkBan, clerkDelete, clerkSignOutEverywhere, clerkUnban } from "@/lib/clerk-admin";
import { db } from "@/lib/db";
import { outranks, type Permission } from "@/lib/site-roles";
import {
  adminDeleteTeamSchema,
  adminDeleteUserSchema,
  adminRenameSchema,
  adminRoleSchema,
  adminSuspendSchema,
  adminUserSchema,
  deleteReportSchema,
  reportStatusSchema,
} from "@/lib/validations";

/**
 * Site-wide staff actions. Every call re-reads the actor from the database
 * (runAction → getViewer), checks the permission, refuses to act on yourself
 * and on equal/higher staff (admins excepted), and writes an audit entry.
 * None of these ever read or return team content.
 */

type Actor = Parameters<Parameters<typeof runAction>[1]>[0]["user"];

async function loadTarget(actor: Actor, userId: string, permission: Permission) {
  requirePermission(actor, permission);
  if (userId === actor.id) throw new ActionError("You can't do that to your own account here. Use the CLI.");
  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, clerkId: true, username: true, siteRole: true, bannedAt: true, deletedAt: true },
  });
  if (!target || target.deletedAt) throw new ActionError("Account not found.");
  if (!outranks(actor.siteRole, target.siteRole)) {
    throw new ActionError("You can only act on accounts below your own role.");
  }
  return target;
}

const done = () => {
  revalidatePath("/admin", "layout");
  return null;
};

export async function suspendUser(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { userId, reason } = adminSuspendSchema.parse(input);
    const target = await loadTarget(ctx.user, userId, "users.suspend");
    if (target.bannedAt) throw new ActionError("That account is already suspended.");
    await db.user.update({ where: { id: target.id }, data: { bannedAt: new Date(), banReason: reason } });
    // Unassign live focus so the team doesn't see a ghost "working on" badge.
    await db.taskAssignee.updateMany({ where: { userId: target.id, focusedAt: { not: null } }, data: { focusedAt: null } });
    await db.team.updateMany({ where: { members: { some: { userId: target.id } } }, data: { activityAt: new Date() } });
    const clerk = await clerkBan(target.clerkId);
    await audit(ctx, { action: "admin.user.suspended", entityType: "User", entityId: target.id });
    done();
    return { clerk };
  });
}

export async function unsuspendUser(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { userId } = adminUserSchema.parse(input);
    const target = await loadTarget(ctx.user, userId, "users.suspend");
    if (!target.bannedAt) throw new ActionError("That account isn't suspended.");
    await db.user.update({ where: { id: target.id }, data: { bannedAt: null, banReason: null } });
    const clerk = await clerkUnban(target.clerkId);
    await audit(ctx, { action: "admin.user.unsuspended", entityType: "User", entityId: target.id });
    done();
    return { clerk };
  });
}

export async function signOutEverywhere(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { userId } = adminUserSchema.parse(input);
    const target = await loadTarget(ctx.user, userId, "users.signout");
    const clerk = await clerkSignOutEverywhere(target.clerkId);
    if (!clerk) throw new ActionError("Clerk didn't accept the request. Try again.");
    await audit(ctx, { action: "admin.user.signed_out", entityType: "User", entityId: target.id });
    return done();
  });
}

export async function setSiteRole(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { userId, role } = adminRoleSchema.parse(input);
    const target = await loadTarget(ctx.user, userId, "users.role");
    if (target.siteRole === role) return null;
    if (role !== "USER" && target.bannedAt) throw new ActionError("Unsuspend the account before giving it a staff role.");
    await db.user.update({ where: { id: target.id }, data: { siteRole: role } });
    await audit(ctx, { action: `admin.user.role.${role}`, entityType: "User", entityId: target.id });
    return done();
  });
}

/**
 * Changes someone's @username, for example to reclaim one that impersonates a
 * person or brand. Admins only. The new name follows the same rules as at
 * sign-up and must be free. Admins may rename their own account here too:
 * unlike a role change, it can't lock anyone out. Their profile colour stays
 * the same, and teammates see the new name on their next live check.
 */
export async function renameUser(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { userId, username } = adminRenameSchema.parse(input);
    requirePermission(ctx.user, "users.rename");
    const target = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, onboarded: true, siteRole: true, deletedAt: true },
    });
    if (!target || target.deletedAt) throw new ActionError("Account not found.");
    if (!target.onboarded || !target.username) throw new ActionError("They haven't picked a username yet.");
    if (target.id !== ctx.user.id && !outranks(ctx.user.siteRole, target.siteRole)) {
      throw new ActionError("You can only act on accounts below your own role.");
    }
    if (target.username === username) return { username };
    try {
      await db.user.update({ where: { id: target.id }, data: { username } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ActionError(`@${username} is already taken.`);
      }
      throw e;
    }
    // Their teammates' screens and their own pick up the new name on the next live check.
    await db.team.updateMany({ where: { members: { some: { userId: target.id } } }, data: { activityAt: new Date() } });
    await inboxChanged([target.id]);
    await audit(ctx, { action: "admin.user.renamed", entityType: "User", entityId: target.id });
    revalidatePath("/dashboard", "layout");
    done();
    return { username };
  });
}

/**
 * Deletes an account: Clerk login removed, memberships and invites removed,
 * owned teams handed to the next admin/member (or deleted when empty), and the
 * row kept as a scrubbed tombstone so shared ideas and tasks stay intact.
 */
export async function deleteUser(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { userId, confirm } = adminDeleteUserSchema.parse(input);
    const target = await loadTarget(ctx.user, userId, "users.delete");
    if (confirm.trim().replace(/^@/, "") !== (target.username ?? "")) {
      throw new ActionError("Type the username exactly to confirm.");
    }
    if (!(await clerkDelete(target.clerkId))) throw new ActionError("Clerk didn't delete the login. Nothing was changed.");
    const teamIds = (await db.teamMember.findMany({ where: { userId: target.id }, select: { teamId: true } })).map((m) => m.teamId);

    await db.$transaction(async (tx) => {
      const owned = await tx.teamMember.findMany({ where: { userId: target.id, role: "OWNER" }, select: { teamId: true } });
      for (const { teamId } of owned) {
        const heir = await tx.teamMember.findFirst({
          where: { teamId, userId: { not: target.id } },
          orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
          select: { id: true, userId: true },
        });
        if (heir) {
          await tx.teamMember.update({ where: { id: heir.id }, data: { role: "OWNER" } });
          await tx.team.update({ where: { id: teamId }, data: { createdById: heir.userId } });
        } else {
          await tx.team.delete({ where: { id: teamId } });
        }
      }
      await tx.taskAssignee.deleteMany({ where: { userId: target.id } });
      await tx.subtaskAssignee.deleteMany({ where: { userId: target.id } });
      await tx.teamInvite.deleteMany({ where: { OR: [{ inviterId: target.id }, { inviteeId: target.id }] } });
      await tx.teamMember.deleteMany({ where: { userId: target.id } });
      // Connected Claude apps go too (their tokens with them).
      await tx.agentGrant.deleteMany({ where: { userId: target.id } });
      await tx.user.update({
        where: { id: target.id },
        data: {
          clerkId: `deleted:${target.id}`,
          email: `deleted+${target.id}@users.noreply.invalid`,
          username: null,
          // Kept for the security record, so staff can still tell who was removed.
          deletedUsername: target.username,
          displayName: null,
          onboarded: false,
          siteRole: "USER",
          bannedAt: null,
          banReason: null,
          deletedAt: new Date(),
        },
      });
    });
    await db.team.updateMany({ where: { id: { in: teamIds } }, data: { activityAt: new Date() } });
    await audit(ctx, { action: "admin.user.deleted", entityType: "User", entityId: target.id });
    return done();
  });
}

export async function adminDeleteTeam(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, confirm } = adminDeleteTeamSchema.parse(input);
    requirePermission(ctx.user, "teams.delete");
    const team = await db.team.findUnique({ where: { id: teamId }, select: { name: true } });
    if (!team) throw new ActionError("Team not found.");
    if (confirm.trim() !== team.name) throw new ActionError("Type the team name exactly to confirm.");
    await db.team.delete({ where: { id: teamId } });
    await audit(ctx, { action: "admin.team.deleted", entityType: "Team", entityId: teamId });
    revalidatePath("/dashboard", "layout");
    return done();
  });
}

/** Marks a bug report resolved, or reopens it. Support staff and above. */
/** Opens, resolves or rejects a piece of feedback. Support staff and above. */
export async function setReportStatus(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { reportId, status } = reportStatusSchema.parse(input);
    requirePermission(ctx.user, "reports.resolve");
    const { count } = await db.bugReport.updateMany({
      where: { id: reportId, status: { not: status } },
      data:
        status === "OPEN"
          ? { status, resolvedAt: null, resolvedById: null }
          : { status, resolvedAt: new Date(), resolvedById: ctx.user.id },
    });
    if (!count) throw new ActionError("It's already like that. Refresh to see the latest.");
    const action = status === "OPEN" ? "admin.report.reopened" : status === "RESOLVED" ? "admin.report.resolved" : "admin.report.rejected";
    await audit(ctx, { action, entityType: "BugReport", entityId: reportId });
    return done();
  });
}

/** Permanently deletes one piece of rejected feedback. Moderators and above; only rejected items. */
export async function deleteRejectedReport(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { reportId } = deleteReportSchema.parse(input);
    requirePermission(ctx.user, "reports.delete");
    const { count } = await db.bugReport.deleteMany({ where: { id: reportId, status: "REJECTED" } });
    if (!count) throw new ActionError("Only rejected feedback can be deleted, and this one isn't (or is already gone).");
    await audit(ctx, { action: "admin.report.deleted", entityType: "BugReport", entityId: reportId });
    return done();
  });
}

/** Permanently deletes every piece of rejected feedback. Moderators and above. */
export async function purgeRejectedReports() {
  return runAction({ tier: "write" }, async (ctx) => {
    requirePermission(ctx.user, "reports.delete");
    const { count } = await db.bugReport.deleteMany({ where: { status: "REJECTED" } });
    if (count) await audit(ctx, { action: "admin.report.purged", entityType: "BugReport", entityId: `rejected:${count}` });
    revalidatePath("/admin", "layout");
    return { count };
  });
}
