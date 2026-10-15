"use server";

import { audit, runAction } from "@/lib/action";
import { teamChanged } from "@/lib/activity";
import { ActionError } from "@/lib/auth";
import { decryptText, encryptOptional, encryptText } from "@/lib/crypto";
import { db } from "@/lib/db";
import { assertCan, assertMembers, requireTeamAccess } from "@/lib/team-access";
import {
  createIdeaSchema,
  createProjectSchema,
  deleteIdeaSchema,
  promoteIdeaSchema,
  teamScoped,
  updateIdeaSchema,
} from "@/lib/validations";

/** Ideas may only carry tags the team has defined. */
async function assertTags(teamId: string, tags: readonly string[]) {
  const unique = [...new Set(tags)];
  if (!unique.length) return;
  const n = await db.teamTag.count({ where: { teamId, name: { in: unique } } });
  if (n !== unique.length) throw new ActionError("Use one of the team's tags. Owners can add more in team settings.");
}

export async function createIdea(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const data = createIdeaSchema.parse(input);
    await requireTeamAccess(data.teamId, ctx.user.id, "ideas.create");
    await assertTags(data.teamId, data.tags);
    const idea = await db.idea.create({
      data: {
        teamId: data.teamId,
        title: encryptText(data.title, data.teamId),
        description: encryptOptional(data.description, data.teamId),
        tags: [...new Set(data.tags)],
        createdById: ctx.user.id,
      },
      select: { id: true },
    });
    await audit(ctx, { teamId: data.teamId, action: "idea.created", entityType: "Idea", entityId: idea.id });
    await teamChanged(data.teamId);
    return { id: idea.id };
  });
}

export async function toggleSpark(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId } = teamScoped.parse(input);
    await requireTeamAccess(teamId, ctx.user.id);
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
    await teamChanged(teamId);
    return { sparked };
  });
}

export async function promoteIdea(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const data = promoteIdeaSchema.parse(input);
    const access = await requireTeamAccess(data.teamId, ctx.user.id, "projects.create");
    if (data.tasks.length) assertCan(access, "tasks.create");

    const idea = await db.idea.findFirst({
      where: { id: data.ideaId, teamId: data.teamId, status: { not: "ARCHIVED" } },
      select: { id: true },
    });
    if (!idea) throw new ActionError("Idea not found.");
    await assertMembers(data.teamId, data.tasks.flatMap((t) => t.assigneeIds));

    await db.$transaction([
      ...data.tasks.map((t) =>
        db.task.create({
          data: {
            teamId: data.teamId,
            ideaId: idea.id,
            title: encryptText(t.title, data.teamId),
            priority: t.priority,
            status: "READY",
            createdById: access.userId,
            assignees: { create: t.assigneeIds.map((userId) => ({ userId, teamId: data.teamId })) },
          },
          select: { id: true },
        }),
      ),
      db.idea.updateMany({ where: { id: idea.id, teamId: data.teamId }, data: { status: "PROMOTED" } }),
    ]);
    await audit(ctx, { teamId: data.teamId, action: "idea.promoted", entityType: "Idea", entityId: idea.id });
    await teamChanged(data.teamId);
    return { created: data.tasks.length };
  });
}

/** Loads an idea in this team with what the permission rules need. */
async function loadIdea(teamId: string, itemId: string) {
  const idea = await db.idea.findFirst({
    where: { id: itemId, teamId },
    select: { title: true, status: true, createdById: true, _count: { select: { tasks: true } } },
  });
  if (!idea) throw new ActionError("Idea not found.");
  // A project is a promoted idea, or an archived one that still has tasks.
  return { ...idea, isProject: idea.status === "PROMOTED" || idea._count.tasks > 0 };
}

const forbid = (what: string) => {
  throw new ActionError(`You don't have permission to ${what}.`);
};

export async function archiveIdea(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId } = teamScoped.parse(input);
    const access = await requireTeamAccess(teamId, ctx.user.id);
    const idea = await loadIdea(teamId, itemId);
    const own = idea.createdById === access.userId;
    if (!own && !access.can(idea.isProject ? "projects.archive" : "ideas.manage")) forbid("archive this");
    await db.idea.updateMany({ where: { id: itemId, teamId }, data: { status: "ARCHIVED" } });
    await db.taskAssignee.updateMany({ where: { teamId, task: { ideaId: itemId }, focusedAt: { not: null } }, data: { focusedAt: null } });
    await audit(ctx, { teamId, action: "idea.archived", entityType: "Idea", entityId: itemId });
    await teamChanged(teamId);
    return null;
  });
}

/** Start a project directly (an idea that skips the vault). */
export async function createProject(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const data = createProjectSchema.parse(input);
    const access = await requireTeamAccess(data.teamId, ctx.user.id, "projects.create");
    const project = await db.idea.create({
      data: {
        teamId: data.teamId,
        title: encryptText(data.title, data.teamId),
        description: encryptOptional(data.description, data.teamId),
        status: "PROMOTED",
        createdById: access.userId,
      },
      select: { id: true },
    });
    await audit(ctx, { teamId: data.teamId, action: "project.created", entityType: "Idea", entityId: project.id });
    await teamChanged(data.teamId);
    return { id: project.id };
  });
}

/** Edit an idea or project: its author, or anyone with ideas.manage (vault) / projects.edit (projects). */
export async function updateIdea(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId, title, description, tags } = updateIdeaSchema.parse(input);
    const access = await requireTeamAccess(teamId, ctx.user.id);
    const idea = await loadIdea(teamId, itemId);
    if (idea.status === "ARCHIVED") throw new ActionError("Restore it before editing.");
    const own = idea.createdById === access.userId;
    if (!own && !access.can(idea.status === "PROMOTED" ? "projects.edit" : "ideas.manage")) forbid("edit this");
    if (tags) await assertTags(teamId, tags);
    await db.idea.updateMany({
      where: { id: itemId, teamId, status: { not: "ARCHIVED" } },
      data: {
        ...(title !== undefined && { title: encryptText(title, teamId) }),
        ...(description !== undefined && { description: encryptOptional(description, teamId) }),
        ...(tags !== undefined && { tags: [...new Set(tags)] }),
      },
    });
    await teamChanged(teamId);
    return null;
  });
}

/** Brings an archived idea back: to Execution if it has tasks, otherwise to the vault. */
export async function restoreIdea(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId } = teamScoped.parse(input);
    const access = await requireTeamAccess(teamId, ctx.user.id);
    const idea = await loadIdea(teamId, itemId);
    if (idea.status !== "ARCHIVED") throw new ActionError("Idea not found.");
    const own = idea.createdById === access.userId;
    if (!own && !access.can(idea.isProject ? "projects.archive" : "ideas.manage")) forbid("restore this");
    const status = idea.isProject ? "PROMOTED" : "VAULT";
    await db.idea.updateMany({ where: { id: itemId, teamId }, data: { status } });
    await audit(ctx, { teamId, action: "idea.restored", entityType: "Idea", entityId: itemId });
    await teamChanged(teamId);
    return { status };
  });
}

/**
 * Permanently deletes an idea or project. Projects can only be deleted by the
 * team owner, and live ones need their exact name as `confirm`. `withTasks`
 * also deletes the project's tasks (otherwise they stay, outside any project).
 */
export async function deleteIdea(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId, confirm, withTasks } = deleteIdeaSchema.parse(input);
    const access = await requireTeamAccess(teamId, ctx.user.id);
    const idea = await loadIdea(teamId, itemId);
    if (idea.isProject) {
      if (!access.can("projects.delete")) forbid("delete projects (only the team owner can)");
      if (idea.status === "PROMOTED" && confirm?.trim() !== decryptText(idea.title, teamId)) {
        throw new ActionError("Type the project name exactly to confirm.");
      }
    } else if (idea.createdById !== access.userId && !access.can("ideas.manage")) {
      forbid("delete this idea");
    }
    await db.$transaction([
      ...(withTasks && idea.isProject ? [db.task.deleteMany({ where: { teamId, ideaId: itemId } })] : []),
      db.idea.deleteMany({ where: { id: itemId, teamId } }),
    ]);
    await audit(ctx, { teamId, action: withTasks ? "idea.deleted.with_tasks" : "idea.deleted", entityType: "Idea", entityId: itemId });
    await teamChanged(teamId);
    return null;
  });
}
