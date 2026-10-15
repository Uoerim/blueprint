"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { audit, runAction } from "@/lib/action";
import { ActionError, requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createTeamSchema,
  deleteTeamSchema,
  id,
  inviteSchema,
  respondInviteSchema,
  slugify,
  teamOnly,
  teamScoped,
  updateTeamSchema,
} from "@/lib/validations";

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

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
    await requireMembership(teamId, ctx.user.id);
    if (inviteeId === ctx.user.id) throw new ActionError("You're already on this team.");

    const invitee = await db.user.findFirst({
      where: { id: inviteeId, onboarded: true },
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
    await requireMembership(teamId, ctx.user.id);
    const { count } = await db.teamInvite.deleteMany({
      where: { id: itemId, teamId, status: "PENDING" },
    });
    if (!count) throw new ActionError("Invite not found.");
    await audit(ctx, { teamId, action: "invite.cancelled", entityType: "TeamInvite", entityId: itemId });
    revalidatePath("/dashboard", "layout");
    return null;
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
    const me = await requireMembership(teamId, ctx.user.id, ["OWNER", "ADMIN"]);
    const target = await db.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
    });
    if (!target) throw new ActionError("Member not found.");
    if (target.role === "OWNER") throw new ActionError("The owner can't be removed.");
    if (me.role === "ADMIN" && target.role === "ADMIN") {
      throw new ActionError("Only the owner can remove an admin.");
    }
    await db.$transaction([
      db.task.updateMany({ where: { teamId, assigneeId: userId }, data: { assigneeId: null, isFocused: false } }),
      db.teamMember.delete({ where: { id: target.id } }),
    ]);
    await audit(ctx, { teamId, action: "member.removed", entityType: "TeamMember", entityId: target.id });
    revalidatePath("/dashboard", "layout");
    return null;
  });
}

export async function setMemberRole(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId: userId, role } = z
      .strictObject({ teamId: id, itemId: id, role: z.enum(["ADMIN", "MEMBER"]) })
      .parse(input);
    await requireMembership(teamId, ctx.user.id, ["OWNER"]);
    const { count } = await db.teamMember.updateMany({
      where: { teamId, userId, role: { not: "OWNER" } },
      data: { role },
    });
    if (!count) throw new ActionError("Member not found.");
    await audit(ctx, { teamId, action: `member.role.${role}`, entityType: "TeamMember", entityId: userId });
    revalidatePath("/dashboard", "layout");
    return null;
  });
}

export async function updateTeam(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, name, description } = updateTeamSchema.parse(input);
    await requireMembership(teamId, ctx.user.id, ["OWNER", "ADMIN"]);
    await db.team.update({ where: { id: teamId }, data: { name, description } });
    await audit(ctx, { teamId, action: "team.updated", entityType: "Team", entityId: teamId });
    revalidatePath("/dashboard", "layout");
    return null;
  });
}

export async function transferOwnership(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId: userId } = teamScoped.parse(input);
    const me = await requireMembership(teamId, ctx.user.id, ["OWNER"]);
    if (userId === ctx.user.id) throw new ActionError("You already own this team.");
    const target = await db.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });
    if (!target) throw new ActionError("Member not found.");
    // The old owner stays on as an admin, so nobody loses access.
    await db.$transaction([
      db.teamMember.update({ where: { id: target.id }, data: { role: "OWNER" } }),
      db.teamMember.update({ where: { id: me.id }, data: { role: "ADMIN" } }),
    ]);
    await audit(ctx, { teamId, action: "team.ownership.transferred", entityType: "TeamMember", entityId: target.id });
    revalidatePath("/dashboard", "layout");
    return null;
  });
}

export async function leaveTeam(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId } = teamOnly.parse(input);
    const me = await requireMembership(teamId, ctx.user.id);
    if (me.role === "OWNER") throw new ActionError("Hand ownership to someone else first, or delete the team.");
    await db.$transaction([
      db.task.updateMany({ where: { teamId, assigneeId: ctx.user.id }, data: { assigneeId: null, isFocused: false } }),
      db.teamMember.delete({ where: { id: me.id } }),
    ]);
    await audit(ctx, { teamId, action: "member.left", entityType: "TeamMember", entityId: me.id });
    revalidatePath("/dashboard", "layout");
    return null;
  });
}

export async function deleteTeam(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, confirm } = deleteTeamSchema.parse(input);
    await requireMembership(teamId, ctx.user.id, ["OWNER"]);
    const team = await db.team.findUnique({ where: { id: teamId }, select: { name: true } });
    if (!team) throw new ActionError("Team not found.");
    if (confirm.trim() !== team.name) throw new ActionError("Type the team name exactly to confirm.");
    // Members, invites, ideas and tasks cascade with the team.
    await db.team.delete({ where: { id: teamId } });
    await audit(ctx, { teamId: null, action: "team.deleted", entityType: "Team", entityId: teamId });
    revalidatePath("/dashboard", "layout");
    return null;
  });
}
