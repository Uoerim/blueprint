"use server";

import { revalidatePath } from "next/cache";
import { audit, runAction } from "@/lib/action";
import { ActionError, requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import { createIdeaSchema, promoteIdeaSchema, teamScoped } from "@/lib/validations";

export async function createIdea(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const data = createIdeaSchema.parse(input);
    await requireMembership(data.teamId, ctx.user.id);
    const idea = await db.idea.create({
      data: {
        teamId: data.teamId,
        title: data.title,
        description: data.description,
        tags: [...new Set(data.tags)],
        createdById: ctx.user.id,
      },
      select: { id: true },
    });
    await audit(ctx, { teamId: data.teamId, action: "idea.created", entityType: "Idea", entityId: idea.id });
    revalidatePath("/dashboard", "layout");
    return { id: idea.id };
  });
}

export async function toggleSpark(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId } = teamScoped.parse(input);
    await requireMembership(teamId, ctx.user.id);
    const sparked = await db.$transaction(async (tx) => {
      const idea = await tx.idea.findFirst({
        where: { id: itemId, teamId },
        select: { sparkedByUserIds: true },
      });
      if (!idea) throw new ActionError("Idea not found.");
      const has = idea.sparkedByUserIds.includes(ctx.user.id);
      const next = has
        ? idea.sparkedByUserIds.filter((u) => u !== ctx.user.id)
        : [...idea.sparkedByUserIds, ctx.user.id];
      await tx.idea.updateMany({
        where: { id: itemId, teamId },
        data: { sparkedByUserIds: next, sparksCount: next.length },
      });
      return !has;
    });
    revalidatePath("/dashboard", "layout");
    return { sparked };
  });
}

export async function promoteIdea(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const data = promoteIdeaSchema.parse(input);
    await requireMembership(data.teamId, ctx.user.id);

    const idea = await db.idea.findFirst({
      where: { id: data.ideaId, teamId: data.teamId, status: { not: "ARCHIVED" } },
      select: { id: true },
    });
    if (!idea) throw new ActionError("Idea not found.");

    // Every assignee must be a member of this exact team.
    const assigneeIds = [...new Set(data.tasks.map((t) => t.assigneeId).filter((v): v is string => !!v))];
    if (assigneeIds.length) {
      const members = await db.teamMember.count({
        where: { teamId: data.teamId, userId: { in: assigneeIds } },
      });
      if (members !== assigneeIds.length) throw new ActionError("Assignees must be on this team.");
    }

    await db.$transaction([
      db.task.createMany({
        data: data.tasks.map((t) => ({
          teamId: data.teamId,
          ideaId: idea.id,
          title: t.title,
          priority: t.priority,
          assigneeId: t.assigneeId ?? null,
          status: "READY" as const,
          createdById: ctx.user.id,
        })),
      }),
      db.idea.updateMany({ where: { id: idea.id, teamId: data.teamId }, data: { status: "PROMOTED" } }),
    ]);
    await audit(ctx, { teamId: data.teamId, action: "idea.promoted", entityType: "Idea", entityId: idea.id });
    revalidatePath("/dashboard", "layout");
    return { created: data.tasks.length };
  });
}

export async function archiveIdea(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId } = teamScoped.parse(input);
    const me = await requireMembership(teamId, ctx.user.id);
    const idea = await db.idea.findFirst({ where: { id: itemId, teamId }, select: { createdById: true } });
    if (!idea) throw new ActionError("Idea not found.");
    if (idea.createdById !== ctx.user.id && me.role === "MEMBER") {
      throw new ActionError("Only the author or an admin can archive this idea.");
    }
    await db.idea.updateMany({ where: { id: itemId, teamId }, data: { status: "ARCHIVED" } });
    await audit(ctx, { teamId, action: "idea.archived", entityType: "Idea", entityId: itemId });
    revalidatePath("/dashboard", "layout");
    return null;
  });
}
