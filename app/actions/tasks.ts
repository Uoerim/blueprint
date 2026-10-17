"use server";

import { z } from "zod";
import { audit, runAction } from "@/lib/action";
import { teamChanged } from "@/lib/activity";
import { ActionError } from "@/lib/auth";
import { encryptOptional, encryptText } from "@/lib/crypto";
import { db } from "@/lib/db";
import { assertMembers, requireTeamAccess, type TeamAccess, assertTeamTags } from "@/lib/team-access";
import {
  canDeleteTask,
  canEditTask,
  canMoveTask,
  canSeeTask,
  canToggleSubtask,
  type TaskAccessFacts,
} from "@/lib/team-permissions";
import {
  createSubtaskSchema,
  createTaskSchema,
  id,
  prioritySchema,
  subtaskAssigneesSchema,
  taskAssigneesSchema,
  taskStatusSchema,
  teamScoped,
  toggleSubtaskSchema,
  updateSubtaskSchema,
  updateTaskSchema,
} from "@/lib/validations";

/*
 * Every task action: proves team membership and loads permissions fresh
 * (requireTeamAccess), loads the task scoped to { id, teamId }, hides tasks the
 * caller can't see (a private task looks exactly like a missing one), then
 * checks the specific rule from lib/team-permissions.ts. Text is validated as
 * plaintext and encrypted with the team's key before it is written.
 */

const MAX_SUBTASKS = 50;

const taskFacts = {
  id: true,
  status: true,
  createdById: true,
  visibility: true,
  assignees: { select: { userId: true } },
  subtasks: { select: { assignees: { select: { userId: true } } } },
} as const;

type LoadedTask = { facts: TaskAccessFacts; status: string };

function factsOf(
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

async function loadTask(access: TeamAccess, taskId: string): Promise<LoadedTask> {
  const t = await db.task.findFirst({ where: { id: taskId, teamId: access.teamId }, select: taskFacts });
  if (!t) throw new ActionError("Task not found.");
  const facts = factsOf(access, t);
  if (!canSeeTask(facts)) throw new ActionError("Task not found.");
  return { facts, status: t.status };
}

async function loadSubtask(access: TeamAccess, subtaskId: string) {
  const s = await db.subtask.findFirst({
    where: { id: subtaskId, teamId: access.teamId },
    select: { id: true, taskId: true, assignees: { select: { userId: true } }, task: { select: taskFacts } },
  });
  if (!s) throw new ActionError("Subtask not found.");
  const facts = factsOf(access, s.task);
  if (!canSeeTask(facts)) throw new ActionError("Subtask not found.");
  return { id: s.id, taskId: s.taskId, assigneeIds: s.assignees.map((a) => a.userId), facts };
}

const deny = (msg = "You don't have permission to change this task.") => {
  throw new ActionError(msg);
};

/** A project is a promoted idea in this exact team. */
/** Tasks belong to a project, or to a raw idea that is still in the vault, in this exact team. */
async function assertProject(teamId: string, projectId: string | null | undefined) {
  if (!projectId) return;
  const p = await db.idea.findFirst({
    where: { id: projectId, teamId, status: { in: ["VAULT", "PROMOTED"] } },
    select: { id: true },
  });
  if (!p) throw new ActionError("Project or idea not found.");
}

const done = async (teamId: string) => {
  await teamChanged(teamId);
  return null;
};

/* ── Tasks ───────────────────────────────────────────────────────────────── */

export async function createTask(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
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
        assignees: { create: assignees.map((userId) => ({ userId, teamId: data.teamId })) },
      },
      select: { id: true },
    });
    await audit(ctx, { teamId: data.teamId, action: "task.created", entityType: "Task", entityId: task.id });
    await teamChanged(data.teamId);
    return { id: task.id };
  });
}

export async function updateTask(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId, title, description, notes, projectId, priority, visibility, tags } = updateTaskSchema.parse(input);
    const access = await requireTeamAccess(teamId, ctx.user.id);
    const { facts } = await loadTask(access, itemId);
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
      },
    });
    return done(teamId);
  });
}

export async function setTaskPriority(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId, priority } = z.strictObject({ teamId: id, itemId: id, priority: prioritySchema }).parse(input);
    const access = await requireTeamAccess(teamId, ctx.user.id);
    const { facts } = await loadTask(access, itemId);
    if (!canEditTask(facts)) deny();
    await db.task.updateMany({ where: { id: itemId, teamId }, data: { priority } });
    return done(teamId);
  });
}

/** Replaces the assignee list. People who stay keep their focus; removed people lose it. */
export async function setTaskAssignees(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId, userIds } = taskAssigneesSchema.parse(input);
    const access = await requireTeamAccess(teamId, ctx.user.id);
    const { facts } = await loadTask(access, itemId);
    if (!canEditTask(facts)) deny();
    const next = await assertMembers(teamId, userIds);
    await db.$transaction([
      db.taskAssignee.deleteMany({ where: { taskId: itemId, userId: { notIn: next } } }),
      db.taskAssignee.createMany({ data: next.map((userId) => ({ taskId: itemId, userId, teamId })), skipDuplicates: true }),
    ]);
    return done(teamId);
  });
}

export async function setTaskStatus(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId, status } = z.strictObject({ teamId: id, itemId: id, status: taskStatusSchema }).parse(input);
    const access = await requireTeamAccess(teamId, ctx.user.id);
    const { facts } = await loadTask(access, itemId);
    if (!canMoveTask(facts)) deny("Only people assigned to this task can move it.");
    await db.$transaction([
      db.task.updateMany({
        where: { id: itemId, teamId },
        data: {
          status,
          completedAt: status === "DONE" ? new Date() : null,
          completedById: status === "DONE" ? access.userId : null,
        },
      }),
      ...(status !== "IN_PROGRESS"
        ? [db.taskAssignee.updateMany({ where: { taskId: itemId, focusedAt: { not: null } }, data: { focusedAt: null } })]
        : []),
    ]);
    if (status === "DONE") await audit(ctx, { teamId, action: "task.done", entityType: "Task", entityId: itemId });
    return done(teamId);
  });
}

/**
 * "Start working": the caller's Live focus moves to this task. One focus per
 * person across the whole site, so starting here ends any focus they had in
 * any team. The start time is the server's clock, never the browser's, so the
 * timer on everyone's screen can't be spoofed. Assignees can always start;
 * editors join the task first.
 */
export async function startFocus(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId } = teamScoped.parse(input);
    const access = await requireTeamAccess(teamId, ctx.user.id);
    const { facts, status } = await loadTask(access, itemId);
    if (status === "DONE") throw new ActionError("That task is already shipped.");
    const assigned = facts.assigneeIds.includes(access.userId);
    if (!assigned && !canEditTask(facts)) deny("Only people assigned to this task can work on it.");
    const now = new Date();
    // Other teams where this focus is about to end, so their live views update too.
    const elsewhere = await db.taskAssignee.findMany({
      where: { userId: access.userId, focusedAt: { not: null }, teamId: { not: teamId } },
      select: { teamId: true },
      distinct: ["teamId"],
    });
    await db.$transaction([
      db.taskAssignee.updateMany({ where: { userId: access.userId, focusedAt: { not: null } }, data: { focusedAt: null } }),
      db.taskAssignee.upsert({
        where: { taskId_userId: { taskId: itemId, userId: access.userId } },
        create: { taskId: itemId, userId: access.userId, teamId, focusedAt: now },
        update: { focusedAt: now },
      }),
      db.task.updateMany({ where: { id: itemId, teamId }, data: { status: "IN_PROGRESS", completedAt: null, completedById: null } }),
    ]);
    await audit(ctx, { teamId, action: "task.focus", entityType: "Task", entityId: itemId });
    await Promise.all(elsewhere.map((e) => teamChanged(e.teamId)));
    return done(teamId);
  });
}

export async function stopFocus(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId } = teamScoped.parse(input);
    const access = await requireTeamAccess(teamId, ctx.user.id);
    await db.taskAssignee.updateMany({ where: { taskId: itemId, teamId, userId: access.userId }, data: { focusedAt: null } });
    return done(teamId);
  });
}

export async function deleteTask(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId } = teamScoped.parse(input);
    const access = await requireTeamAccess(teamId, ctx.user.id);
    const { facts } = await loadTask(access, itemId);
    if (!canDeleteTask(facts)) deny("You don't have permission to delete this task.");
    await db.task.deleteMany({ where: { id: itemId, teamId } });
    await audit(ctx, { teamId, action: "task.deleted", entityType: "Task", entityId: itemId });
    return done(teamId);
  });
}

/* ── Subtasks ────────────────────────────────────────────────────────────── */

export async function createSubtask(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { id: subId, teamId, taskId, title, description, assigneeIds } = createSubtaskSchema.parse(input);
    const access = await requireTeamAccess(teamId, ctx.user.id);
    const { facts } = await loadTask(access, taskId);
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
        assignees: { create: assignees.map((userId) => ({ userId })) },
      },
      select: { id: true },
    });
    await teamChanged(teamId);
    return { id: sub.id };
  });
}

export async function updateSubtask(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId, title, description } = updateSubtaskSchema.parse(input);
    const access = await requireTeamAccess(teamId, ctx.user.id);
    const sub = await loadSubtask(access, itemId);
    if (!canEditTask(sub.facts)) deny();
    await db.subtask.updateMany({
      where: { id: itemId, teamId },
      data: {
        ...(title !== undefined && { title: encryptText(title, teamId) }),
        ...(description !== undefined && { description: encryptOptional(description, teamId) }),
      },
    });
    return done(teamId);
  });
}

export async function toggleSubtask(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId, done: isDone } = toggleSubtaskSchema.parse(input);
    const access = await requireTeamAccess(teamId, ctx.user.id);
    const sub = await loadSubtask(access, itemId);
    if (!canToggleSubtask(sub.facts, sub.assigneeIds)) deny("Only people assigned to this subtask can tick it.");
    await db.subtask.updateMany({ where: { id: itemId, teamId }, data: { done: isDone, completedAt: isDone ? new Date() : null } });
    return done(teamId);
  });
}

export async function setSubtaskAssignees(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId, userIds } = subtaskAssigneesSchema.parse(input);
    const access = await requireTeamAccess(teamId, ctx.user.id);
    const sub = await loadSubtask(access, itemId);
    if (!canEditTask(sub.facts)) deny();
    const next = await assertMembers(teamId, userIds);
    await db.$transaction([
      db.subtaskAssignee.deleteMany({ where: { subtaskId: itemId, userId: { notIn: next } } }),
      db.subtaskAssignee.createMany({ data: next.map((userId) => ({ subtaskId: itemId, userId })), skipDuplicates: true }),
    ]);
    return done(teamId);
  });
}

export async function deleteSubtask(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId } = teamScoped.parse(input);
    const access = await requireTeamAccess(teamId, ctx.user.id);
    const sub = await loadSubtask(access, itemId);
    if (!canEditTask(sub.facts)) deny();
    await db.subtask.deleteMany({ where: { id: itemId, teamId } });
    return done(teamId);
  });
}
