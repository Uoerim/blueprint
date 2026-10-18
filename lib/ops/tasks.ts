import "server-only";
import { z } from "zod";
import { audit, type Ctx } from "@/lib/action";
import { teamChanged } from "@/lib/activity";
import type { AuditAction } from "@/lib/audit";
import { ActionError } from "@/lib/auth";
import { encryptOptional, encryptText } from "@/lib/crypto";
import { db } from "@/lib/db";
import { assertMembers, assertTeamTags, requireTeamAccess, type TeamAccess } from "@/lib/team-access";
import { canEditTask, canMoveTask, canSeeTask, canToggleSubtask, type TaskAccessFacts } from "@/lib/team-permissions";
import { createSubtaskSchema, createTaskSchema, id, taskStatusSchema, toggleSubtaskSchema, updateTaskSchema } from "@/lib/validations";

/*
 * The task operations shared by the app's server actions (app/actions/tasks.ts,
 * signed in with a session) and Connect Claude (lib/mcp, signed in with a token).
 * Both arrive here with the same Ctx, so both get exactly the same checks:
 * team membership and permissions read fresh, the task loaded scoped to its
 * team, private tasks hidden, then the specific rule from team-permissions.ts.
 * Text is validated as plaintext and encrypted with the team's key.
 *
 * Every change is recorded in the team's activity (the append-only audit
 * trail) with its task and project. When Claude makes it (ctx.via), the
 * entry says so, and the task itself is marked: "createdVia" for things Claude
 * made (permanent, guarded by a database trigger), "completedVia" for things
 * it finished, and "claudeAt" for the last time it worked on the task (which
 * can never be cleared).
 */

export const MAX_SUBTASKS = 50;

export const taskFacts = {
  id: true,
  status: true,
  ideaId: true,
  createdById: true,
  visibility: true,
  assignees: { select: { userId: true } },
  subtasks: { select: { assignees: { select: { userId: true } } } },
} as const;

export type LoadedTask = { facts: TaskAccessFacts; status: string; ideaId: string | null };

export function factsOf(
  access: TeamAccess,
  t: { createdById: string; visibility: "TEAM" | "ASSIGNEES"; assignees: { userId: string }[]; subtasks: { assignees: { userId: string }[] }[] },
): TaskAccessFacts {
  return {
    me: access.userId,
    perms: access.perms,
    createdById: t.createdById,
    visibility: t.visibility,
    assigneeIds: t.assignees.map((a) => a.userId),
    subtaskAssigneeIds: t.subtasks.flatMap((s) => s.assignees.map((a) => a.userId)),
  };
}

export async function loadTask(access: TeamAccess, taskId: string): Promise<LoadedTask> {
  const t = await db.task.findFirst({ where: { id: taskId, teamId: access.teamId }, select: taskFacts });
  if (!t) throw new ActionError("Task not found.");
  const facts = factsOf(access, t);
  if (!canSeeTask(facts)) throw new ActionError("Task not found.");
  return { facts, status: t.status, ideaId: t.ideaId };
}

export async function loadSubtask(access: TeamAccess, subtaskId: string) {
  const s = await db.subtask.findFirst({
    where: { id: subtaskId, teamId: access.teamId },
    select: { id: true, taskId: true, assignees: { select: { userId: true } }, task: { select: taskFacts } },
  });
  if (!s) throw new ActionError("Subtask not found.");
  const facts = factsOf(access, s.task);
  if (!canSeeTask(facts)) throw new ActionError("Subtask not found.");
  return { id: s.id, taskId: s.taskId, ideaId: s.task.ideaId, assigneeIds: s.assignees.map((a) => a.userId), facts };
}

export const deny = (msg = "You don't have permission to change this task.") => {
  throw new ActionError(msg);
};

/** Tasks belong to a project, or to a raw idea that is still in the vault, in this exact team. */
export async function assertProject(teamId: string, projectId: string | null | undefined) {
  if (!projectId) return;
  const p = await db.idea.findFirst({
    where: { id: projectId, teamId, status: { in: ["VAULT", "PROMOTED"] } },
    select: { id: true },
  });
  if (!p) throw new ActionError("Project or idea not found.");
}

export const done = async (teamId: string) => {
  await teamChanged(teamId);
  return null;
};

/** Records a task or subtask event in the team's activity, tied to its task and project. */
export function logTask(
  ctx: Ctx,
  e: { teamId: string; action: AuditAction; taskId: string; ideaId: string | null; subtaskId?: string; detail?: string },
) {
  return audit(ctx, {
    teamId: e.teamId,
    action: e.action,
    entityType: e.subtaskId ? "Subtask" : "Task",
    entityId: e.subtaskId ?? e.taskId,
    taskId: e.taskId,
    ideaId: e.ideaId,
    ...(e.detail && { detail: e.detail }),
  });
}

/** When Claude changes a task (or one of its subtasks), the task remembers it. */
export async function markClaude(ctx: Ctx, teamId: string, taskId: string) {
  if (ctx.via === "claude") await db.task.updateMany({ where: { id: taskId, teamId }, data: { claudeAt: new Date() } });
}

export async function opCreateTask(ctx: Ctx, input: unknown) {
  const data = createTaskSchema.parse(input);
  const access = await requireTeamAccess(data.teamId, ctx.user.id, "tasks.create");
  const assignees = await assertMembers(data.teamId, data.assigneeIds);
  await assertProject(data.teamId, data.projectId);
  const tags = await assertTeamTags(data.teamId, data.tags);
  const task = await db.task.create({
    data: {
      ...(data.id && { id: data.id }),
      teamId: data.teamId,
      title: encryptText(data.title, data.teamId),
      description: encryptOptional(data.description, data.teamId),
      notes: encryptOptional(data.notes, data.teamId),
      priority: data.priority,
      visibility: data.visibility,
      tags,
      ideaId: data.projectId ?? null,
      createdById: access.userId,
      createdVia: ctx.via ?? null,
      claudeAt: ctx.via === "claude" ? new Date() : null,
      assignees: { create: assignees.map((userId) => ({ userId, teamId: data.teamId })) },
    },
    select: { id: true },
  });
  await logTask(ctx, { teamId: data.teamId, action: "task.created", taskId: task.id, ideaId: data.projectId ?? null });
  await teamChanged(data.teamId);
  return { id: task.id };
}

export async function opUpdateTask(ctx: Ctx, input: unknown) {
  const { teamId, itemId, title, description, notes, projectId, priority, visibility, tags } = updateTaskSchema.parse(input);
  const access = await requireTeamAccess(teamId, ctx.user.id);
  const { facts, ideaId } = await loadTask(access, itemId);
  if (!canEditTask(facts)) deny();
  await assertProject(teamId, projectId);
  const nextTags = tags === undefined ? undefined : await assertTeamTags(teamId, tags);
  await db.task.updateMany({
    where: { id: itemId, teamId },
    data: {
      ...(nextTags !== undefined && { tags: nextTags }),
      ...(title !== undefined && { title: encryptText(title, teamId) }),
      ...(description !== undefined && { description: encryptOptional(description, teamId) }),
      ...(notes !== undefined && { notes: encryptOptional(notes, teamId) }),
      ...(projectId !== undefined && { ideaId: projectId }),
      ...(priority !== undefined && { priority }),
      ...(visibility !== undefined && { visibility }),
      ...(ctx.via === "claude" && { claudeAt: new Date() }),
    },
  });
  // Which fields changed (names only, never the text).
  const fields = Object.entries({ title, description, notes, project: projectId, priority, visibility, tags })
    .filter(([, v]) => v !== undefined)
    .map(([k]) => k);
  await logTask(ctx, { teamId, action: "task.updated", taskId: itemId, ideaId: projectId !== undefined ? projectId : ideaId, detail: fields.join(",") });
  return done(teamId);
}

export async function opSetTaskStatus(ctx: Ctx, input: unknown) {
  const { teamId, itemId, status } = z.strictObject({ teamId: id, itemId: id, status: taskStatusSchema }).parse(input);
  const access = await requireTeamAccess(teamId, ctx.user.id);
  const { facts, ideaId } = await loadTask(access, itemId);
  if (!canMoveTask(facts)) deny("Only people assigned to this task can move it.");
  await db.$transaction([
    db.task.updateMany({
      where: { id: itemId, teamId },
      data: {
        status,
        completedAt: status === "DONE" ? new Date() : null,
        completedById: status === "DONE" ? access.userId : null,
        completedVia: status === "DONE" ? (ctx.via ?? null) : null,
        ...(ctx.via === "claude" && { claudeAt: new Date() }),
      },
    }),
    ...(status !== "IN_PROGRESS"
      ? [db.taskAssignee.updateMany({ where: { taskId: itemId, focusedAt: { not: null } }, data: { focusedAt: null } })]
      : []),
  ]);
  await logTask(ctx, { teamId, action: "task.moved", taskId: itemId, ideaId, detail: status });
  return done(teamId);
}

export async function opCreateSubtask(ctx: Ctx, input: unknown) {
  const { id: subId, teamId, taskId, title, description, assigneeIds } = createSubtaskSchema.parse(input);
  const access = await requireTeamAccess(teamId, ctx.user.id);
  const { facts, ideaId } = await loadTask(access, taskId);
  if (!canEditTask(facts)) deny();
  const assignees = await assertMembers(teamId, assigneeIds);
  const agg = await db.subtask.aggregate({ where: { taskId, teamId }, _count: true, _max: { position: true } });
  if (agg._count >= MAX_SUBTASKS) throw new ActionError(`A task can have at most ${MAX_SUBTASKS} subtasks.`);
  const sub = await db.subtask.create({
    data: {
      ...(subId && { id: subId }),
      teamId,
      taskId,
      title: encryptText(title, teamId),
      description: encryptOptional(description, teamId),
      position: (agg._max.position ?? -1) + 1,
      createdById: access.userId,
      createdVia: ctx.via ?? null,
      assignees: { create: assignees.map((userId) => ({ userId })) },
    },
    select: { id: true },
  });
  await markClaude(ctx, teamId, taskId);
  await logTask(ctx, { teamId, action: "subtask.created", taskId, ideaId, subtaskId: sub.id });
  await teamChanged(teamId);
  return { id: sub.id };
}

export async function opToggleSubtask(ctx: Ctx, input: unknown) {
  const { teamId, itemId, done: isDone } = toggleSubtaskSchema.parse(input);
  const access = await requireTeamAccess(teamId, ctx.user.id);
  const sub = await loadSubtask(access, itemId);
  if (!canToggleSubtask(sub.facts, sub.assigneeIds)) deny("Only people assigned to this subtask can tick it.");
  await db.subtask.updateMany({
    where: { id: itemId, teamId },
    data: { done: isDone, completedAt: isDone ? new Date() : null, completedVia: isDone ? (ctx.via ?? null) : null },
  });
  await markClaude(ctx, teamId, sub.taskId);
  await logTask(ctx, { teamId, action: isDone ? "subtask.done" : "subtask.reopened", taskId: sub.taskId, ideaId: sub.ideaId, subtaskId: itemId });
  return done(teamId);
}
