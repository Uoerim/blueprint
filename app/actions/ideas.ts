"use server";

import { revalidatePath } from "next/cache";
import { audit, runAction } from "@/lib/action";
import { ActionError, requireMembership } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createIdeaSchema,
  createProjectSchema,
  deleteIdeaSchema,
  promoteIdeaSchema,
  teamScoped,
  updateProjectSchema,
} from "@/lib/validations";

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

/** Start a project directly (an idea that skips the vault). */
export async function createProject(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const data = createProjectSchema.parse(input);
    await requireMembership(data.teamId, ctx.user.id);
    const project = await db.idea.create({
      data: {
        teamId: data.teamId,
        title: data.title,
        description: data.description,
        status: "PROMOTED",
        createdById: ctx.user.id,
      },
      select: { id: true },
    });
    await audit(ctx, { teamId: data.teamId, action: "project.created", entityType: "Idea", entityId: project.id });
    revalidatePath("/dashboard", "layout");
    return { id: project.id };
  });
}

/** Edit a project's title, description or notes. Any member can; it is a shared page. */
export async function updateProject(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId, title, description, notes } = updateProjectSchema.parse(input);
    await requireMembership(teamId, ctx.user.id);
    const { count } = await db.idea.updateMany({
      where: { id: itemId, teamId, status: "PROMOTED" },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(notes !== undefined && { notes }),
      },
    });
    if (!count) throw new ActionError("Project not found.");
    revalidatePath("/dashboard", "layout");
    return null;
  });
}

/** Brings an archived idea back: to Execution if it has tasks, otherwise to the vault. */
export async function restoreIdea(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId } = teamScoped.parse(input);
    const me = await requireMembership(teamId, ctx.user.id);
    const idea = await db.idea.findFirst({
      where: { id: itemId, teamId, status: "ARCHIVED" },
      select: { createdById: true, _count: { select: { tasks: true } } },
    });
    if (!idea) throw new ActionError("Idea not found.");
    if (idea.createdById !== ctx.user.id && me.role === "MEMBER") {
      throw new ActionError("Only the author or an admin can restore this.");
    }
    const status = idea._count.tasks > 0 ? "PROMOTED" : "VAULT";
    await db.idea.updateMany({ where: { id: itemId, teamId }, data: { status } });
    await audit(ctx, { teamId, action: "idea.restored", entityType: "Idea", entityId: itemId });
    revalidatePath("/dashboard", "layout");
    return { status };
  });
}

/**
 * Permanently deletes an idea or project. Live projects need their exact title
 * as `confirm`; `withTasks` also deletes the project's tasks (otherwise they
 * stay on the board without a project).
 */
export async function deleteIdea(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId, confirm, withTasks } = deleteIdeaSchema.parse(input);
    const me = await requireMembership(teamId, ctx.user.id);
    const idea = await db.idea.findFirst({
      where: { id: itemId, teamId },
      select: { title: true, status: true, createdById: true },
    });
    if (!idea) throw new ActionError("Idea not found.");
    if (idea.createdById !== ctx.user.id && me.role === "MEMBER") {
      throw new ActionError("Only the author or an admin can delete this.");
    }
    if (idea.status === "PROMOTED" && confirm?.trim() !== idea.title) {
      throw new ActionError("Type the project name exactly to confirm.");
    }
    await db.$transaction([
      ...(withTasks ? [db.task.deleteMany({ where: { teamId, ideaId: itemId } })] : []),
      db.idea.deleteMany({ where: { id: itemId, teamId } }),
    ]);
    await audit(ctx, { teamId, action: withTasks ? "idea.deleted.with_tasks" : "idea.deleted", entityType: "Idea", entityId: itemId });
    revalidatePath("/dashboard", "layout");
    return null;
  });
}
