"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { audit, runAction } from "@/lib/action";
import { ActionError } from "@/lib/auth";
import { db } from "@/lib/db";
import { assertCan, requireTeamAccess, type TeamAccess } from "@/lib/team-access";
import { permissionsFor } from "@/lib/team-permissions";
import {
  confirmedTeamSchema,
  createRoleSchema,
  createTeamSchema,
  inviteSchema,
  memberCustomRoleSchema,
  memberRoleSchema,
  respondInviteSchema,
  slugify,
  teamOnly,
  teamScoped,
  updateRoleSchema,
  updateTeamSchema,
} from "@/lib/validations";

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

const MAX_ROLES = 20;

const done = () => {
  revalidatePath("/dashboard", "layout");
  return null;
};

/** Removes someone's task and subtask assignments (and focus) in one team. */
function unassignAll(teamId: string, userId: string) {
  return [
    db.taskAssignee.deleteMany({ where: { teamId, userId } }),
    db.subtaskAssignee.deleteMany({ where: { userId, subtask: { teamId } } }),
  ];
}

async function assertTeamName(teamId: string, confirm: string) {
  const team = await db.team.findUnique({ where: { id: teamId }, select: { name: true } });
  if (!team) throw new ActionError("Team not found.");
  if (confirm.trim() !== team.name) throw new ActionError("Type the team name exactly to confirm.");
}

/** Another member of this team, with their role and custom role permissions. */
async function loadMember(teamId: string, userId: string) {
  const m = await db.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { id: true, role: true, customRole: { select: { permissions: true } } },
  });
  if (!m) throw new ActionError("Member not found.");
  return m;
}

/** Members with members.manage (but not co-owners) may only touch people and roles with no more power than their own. */
function assertWithinPower(access: TeamAccess, permissions: readonly string[]) {
  if (access.role !== "MEMBER") return;
  if (permissionsFor("MEMBER", permissions).some((p) => !access.can(p))) {
    throw new ActionError("You can only manage people and roles with permissions you have yourself.");
  }
}

export async function createTeam(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const data = createTeamSchema.parse(input);
    const base = data.slug ?? slugify(data.name);
    const candidates = data.slug
      ? [base]
      : [base, ...Array.from({ length: 3 }, () => `${base.slice(0, 33)}-${Math.random().toString(36).slice(2, 6)}`)];

    for (const slug of candidates) {
      try {
        const team = await db.team.create({
          data: {
            name: data.name,
            slug,
            description: data.description,
            createdById: ctx.user.id,
            members: { create: { userId: ctx.user.id, role: "OWNER" } },
          },
          select: { id: true, slug: true },
        });
        await audit(ctx, { teamId: team.id, action: "team.created", entityType: "Team", entityId: team.id });
        revalidatePath("/dashboard", "layout");
        return { slug: team.slug };
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
      }
    }
    throw new ActionError(data.slug ? `/${base} is taken. Pick another slug.` : "Couldn't create a unique slug.");
  });
}

export async function sendInvite(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, inviteeId } = inviteSchema.parse(input);
    await requireTeamAccess(teamId, ctx.user.id, "members.invite");
    if (inviteeId === ctx.user.id) throw new ActionError("You're already on this team.");

    const invitee = await db.user.findFirst({
      where: { id: inviteeId, onboarded: true, bannedAt: null, deletedAt: null },
      select: { id: true, username: true },
    });
    if (!invitee) throw new ActionError("User not found.");

    const already = await db.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: inviteeId } },
      select: { id: true },
    });
    if (already) throw new ActionError(`@${invitee.username} is already on the team.`);

    try {
      const invite = await db.teamInvite.create({
        data: { teamId, inviterId: ctx.user.id, inviteeId },
        select: { id: true },
      });
      await audit(ctx, { teamId, action: "invite.sent", entityType: "TeamInvite", entityId: invite.id });
    } catch (e) {
      if (isUniqueViolation(e)) throw new ActionError(`@${invitee.username} already has a pending invite.`);
      throw e;
    }
    revalidatePath("/dashboard", "layout");
    return { username: invitee.username };
  });
}

export async function cancelInvite(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId } = teamScoped.parse(input);
    const access = await requireTeamAccess(teamId, ctx.user.id);
    const { count } = await db.teamInvite.deleteMany({
      where: {
        id: itemId,
        teamId,
        status: "PENDING",
        ...(!access.can("members.invite") && { inviterId: access.userId }),
      },
    });
    if (!count) throw new ActionError("Invite not found.");
    await audit(ctx, { teamId, action: "invite.cancelled", entityType: "TeamInvite", entityId: itemId });
    return done();
  });
}

export async function respondInvite(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { inviteId, accept } = respondInviteSchema.parse(input);
    // Scoped to the viewer: nobody can answer someone else's invite.
    const invite = await db.teamInvite.findFirst({
      where: { id: inviteId, inviteeId: ctx.user.id, status: "PENDING" },
      select: { id: true, teamId: true, team: { select: { slug: true } } },
    });
    if (!invite) throw new ActionError("Invite not found.");
    const status = accept ? "ACCEPTED" : "DECLINED";

    await db.$transaction(async (tx) => {
      // (teamId, inviteeId, status) is unique: clear an older answered row first.
      await tx.teamInvite.deleteMany({
        where: { teamId: invite.teamId, inviteeId: ctx.user.id, status },
      });
      await tx.teamInvite.update({
        where: { id: invite.id },
        data: { status, respondedAt: new Date() },
      });
      if (accept) {
        await tx.teamMember.upsert({
          where: { teamId_userId: { teamId: invite.teamId, userId: ctx.user.id } },
          create: { teamId: invite.teamId, userId: ctx.user.id, role: "MEMBER" },
          update: {},
        });
      }
    });
    await audit(ctx, {
      teamId: invite.teamId,
      action: accept ? "invite.accepted" : "invite.declined",
      entityType: "TeamInvite",
      entityId: invite.id,
    });
    revalidatePath("/dashboard", "layout");
    return { slug: accept ? invite.team.slug : null };
  });
}

export async function removeMember(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId: userId } = teamScoped.parse(input);
    const access = await requireTeamAccess(teamId, ctx.user.id);
    if (userId === access.userId) throw new ActionError("Use Leave team to leave.");
    const target = await loadMember(teamId, userId);
    if (target.role === "OWNER") throw new ActionError("The owner can't be removed.");
    if (target.role === "CO_OWNER") assertCan(access, "members.coOwner");
    else {
      assertCan(access, "members.manage");
      assertWithinPower(access, target.customRole?.permissions ?? []);
    }
    await db.$transaction([...unassignAll(teamId, userId), db.teamMember.delete({ where: { id: target.id } })]);
    await audit(ctx, { teamId, action: "member.removed", entityType: "TeamMember", entityId: target.id });
    return done();
  });
}

/** Owner only: make someone a co-owner, or a co-owner back into a member. */
export async function setMemberRole(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId: userId, role } = memberRoleSchema.parse(input);
    await requireTeamAccess(teamId, ctx.user.id, "members.coOwner");
    if (userId === ctx.user.id) throw new ActionError("You can't change your own role.");
    const target = await loadMember(teamId, userId);
    if (target.role === "OWNER") throw new ActionError("Transfer ownership instead.");
    await db.teamMember.update({ where: { id: target.id }, data: { role, customRoleId: null } });
    await audit(ctx, { teamId, action: `member.role.${role}`, entityType: "TeamMember", entityId: target.id });
    return done();
  });
}

/** Give a member a custom role (or none, for the default member permissions). */
export async function setMemberCustomRole(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId: userId, roleId } = memberCustomRoleSchema.parse(input);
    const access = await requireTeamAccess(teamId, ctx.user.id, "members.manage");
    if (userId === access.userId) throw new ActionError("You can't change your own role.");
    const target = await loadMember(teamId, userId);
    if (target.role !== "MEMBER") throw new ActionError("Owners and co-owners don't take custom roles.");
    assertWithinPower(access, target.customRole?.permissions ?? []);
    if (roleId) {
      const role = await db.teamRole.findFirst({ where: { id: roleId, teamId }, select: { permissions: true } });
      if (!role) throw new ActionError("Role not found.");
      assertWithinPower(access, role.permissions);
    }
    await db.teamMember.update({ where: { id: target.id }, data: { customRoleId: roleId } });
    await audit(ctx, { teamId, action: "member.custom_role", entityType: "TeamMember", entityId: target.id });
    return done();
  });
}

/* ── Custom roles (owner and co-owners) ──────────────────────────────────── */

export async function createTeamRole(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, name, color, permissions } = createRoleSchema.parse(input);
    await requireTeamAccess(teamId, ctx.user.id, "roles.manage");
    if ((await db.teamRole.count({ where: { teamId } })) >= MAX_ROLES) {
      throw new ActionError(`A team can have at most ${MAX_ROLES} custom roles.`);
    }
    try {
      const role = await db.teamRole.create({ data: { teamId, name, color, permissions }, select: { id: true } });
      await audit(ctx, { teamId, action: "role.created", entityType: "TeamRole", entityId: role.id });
      revalidatePath("/dashboard", "layout");
      return { id: role.id };
    } catch (e) {
      if (isUniqueViolation(e)) throw new ActionError(`There's already a role called "${name}".`);
      throw e;
    }
  });
}

export async function updateTeamRole(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId, name, color, permissions } = updateRoleSchema.parse(input);
    await requireTeamAccess(teamId, ctx.user.id, "roles.manage");
    try {
      const { count } = await db.teamRole.updateMany({ where: { id: itemId, teamId }, data: { name, color, permissions } });
      if (!count) throw new ActionError("Role not found.");
    } catch (e) {
      if (isUniqueViolation(e)) throw new ActionError(`There's already a role called "${name}".`);
      throw e;
    }
    await audit(ctx, { teamId, action: "role.updated", entityType: "TeamRole", entityId: itemId });
    return done();
  });
}

/** Members who had the role fall back to the default member permissions. */
export async function deleteTeamRole(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId } = teamScoped.parse(input);
    await requireTeamAccess(teamId, ctx.user.id, "roles.manage");
    const { count } = await db.teamRole.deleteMany({ where: { id: itemId, teamId } });
    if (!count) throw new ActionError("Role not found.");
    await audit(ctx, { teamId, action: "role.deleted", entityType: "TeamRole", entityId: itemId });
    return done();
  });
}

/* ── Team ────────────────────────────────────────────────────────────────── */

export async function updateTeam(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, name, description } = updateTeamSchema.parse(input);
    await requireTeamAccess(teamId, ctx.user.id, "team.edit");
    await db.team.update({ where: { id: teamId }, data: { name, description } });
    await audit(ctx, { teamId, action: "team.updated", entityType: "Team", entityId: teamId });
    return done();
  });
}

/** The owner hands the team over and stays on as a co-owner. */
export async function transferOwnership(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId: userId } = teamScoped.parse(input);
    const access = await requireTeamAccess(teamId, ctx.user.id, "members.coOwner");
    if (userId === access.userId) throw new ActionError("You already own this team.");
    const target = await loadMember(teamId, userId);
    await db.$transaction([
      db.teamMember.update({ where: { id: target.id }, data: { role: "OWNER", customRoleId: null } }),
      db.teamMember.update({ where: { id: access.memberId }, data: { role: "CO_OWNER", customRoleId: null } }),
      db.team.update({ where: { id: teamId }, data: { createdById: userId } }),
    ]);
    await audit(ctx, { teamId, action: "team.ownership.transferred", entityType: "TeamMember", entityId: target.id });
    return done();
  });
}

export async function leaveTeam(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId } = teamOnly.parse(input);
    const access = await requireTeamAccess(teamId, ctx.user.id);
    if (access.role === "OWNER") throw new ActionError("Hand ownership to someone else first, or delete the team.");
    await db.$transaction([...unassignAll(teamId, access.userId), db.teamMember.delete({ where: { id: access.memberId } })]);
    await audit(ctx, { teamId, action: "member.left", entityType: "TeamMember", entityId: access.memberId });
    return done();
  });
}

export async function deleteTeam(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, confirm } = confirmedTeamSchema.parse(input);
    await requireTeamAccess(teamId, ctx.user.id, "team.delete");
    await assertTeamName(teamId, confirm);
    // Members, invites, roles, ideas, tasks and subtasks cascade with the team.
    await db.team.delete({ where: { id: teamId } });
    await audit(ctx, { teamId: null, action: "team.deleted", entityType: "Team", entityId: teamId });
    return done();
  });
}

/** Permanently deletes every finished task (empties Shipped). */
export async function clearShipped(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, confirm } = confirmedTeamSchema.parse(input);
    await requireTeamAccess(teamId, ctx.user.id, "team.cleanup");
    await assertTeamName(teamId, confirm);
    const { count } = await db.task.deleteMany({ where: { teamId, status: "DONE" } });
    await audit(ctx, { teamId, action: "team.shipped.cleared", entityType: "Team", entityId: teamId });
    revalidatePath("/dashboard", "layout");
    return { count };
  });
}

/**
 * Permanently deletes the archive. Archived projects (ideas that still have
 * tasks) are only included for the owner, since only the owner deletes projects.
 */
export async function emptyArchive(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, confirm } = confirmedTeamSchema.parse(input);
    const access = await requireTeamAccess(teamId, ctx.user.id, "team.cleanup");
    await assertTeamName(teamId, confirm);
    const { count } = await db.idea.deleteMany({
      where: { teamId, status: "ARCHIVED", ...(!access.can("projects.delete") && { tasks: { none: {} } }) },
    });
    await audit(ctx, { teamId, action: "team.archive.emptied", entityType: "Team", entityId: teamId });
    revalidatePath("/dashboard", "layout");
    return { count };
  });
}
