"use server";

import { z } from "zod";
import { audit, runAction } from "@/lib/action";
import { teamChanged } from "@/lib/activity";
import { ActionError } from "@/lib/auth";
import { encryptOptional, encryptText } from "@/lib/crypto";
import { db } from "@/lib/db";
import { deny, done, loadSubtask, loadTask, opCreateSubtask, opCreateTask, opSetTaskStatus, opToggleSubtask, opUpdateTask } from "@/lib/ops/tasks";
import { assertMembers, requireTeamAccess } from "@/lib/team-access";
import { canDeleteTask, canEditTask } from "@/lib/team-permissions";
import { id, prioritySchema, subtaskAssigneesSchema, taskAssigneesSchema, teamScoped, updateSubtaskSchema } from "@/lib/validations";

/*
 * Every task action (the ones Claude can use too live in lib/ops/tasks.ts): proves team membership and loads permissions fresh
 * (requireTeamAccess), loads the task scoped to { id, teamId }, hides tasks the
 * caller can't see (a private task looks exactly like a missing one), then
 * checks the specific rule from lib/team-permissions.ts. Text is validated as
 * plaintext and encrypted with the team's key before it is written.
 */

/* ── Tasks ───────────────────────────────────────────────────────────────── */

export async function createTask(input: unknown) {
  return runAction({ tier: "write" }, (ctx) => opCreateTask(ctx, input));
}

export async function updateTask(input: unknown) {
  return runAction({ tier: "write" }, (ctx) => opUpdateTask(ctx, input));
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
  return runAction({ tier: "write" }, (ctx) => opSetTaskStatus(ctx, input));
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
  return runAction({ tier: "write" }, (ctx) => opCreateSubtask(ctx, input));
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
  return runAction({ tier: "write" }, (ctx) => opToggleSubtask(ctx, input));
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
