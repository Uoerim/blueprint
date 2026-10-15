"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, runAction } from "@/lib/action";
import { ActionError, requireMembership } from "@/lib/auth";
import { encryptOptional, encryptText } from "@/lib/crypto";
import { db } from "@/lib/db";
import { createTaskSchema, id, prioritySchema, taskStatusSchema, teamScoped, updateTaskSchema } from "@/lib/validations";

async function assertAssignee(teamId: string, assigneeId: string | null | undefined) {
  if (!assigneeId) return;
  const m = await db.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: assigneeId } },
    select: { id: true },
  });
  if (!m) throw new ActionError("Assignee must be on this team.");
}

/** A project is a promoted idea; it must live in this exact team and not be archived. */
async function assertProject(teamId: string, projectId: string | null | undefined) {
  if (!projectId) return;
  const p = await db.idea.findFirst({
    where: { id: projectId, teamId, status: "PROMOTED" },
    select: { id: true },
  });
  if (!p) throw new ActionError("Project not found.");
}

function touched(count: number) {
  if (!count) throw new ActionError("Task not found.");
  revalidatePath("/dashboard", "layout");
  return null;
}

export async function createTask(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const data = createTaskSchema.parse(input);
    await requireMembership(data.teamId, ctx.user.id);
    await assertAssignee(data.teamId, data.assigneeId);
    await assertProject(data.teamId, data.projectId);
    const task = await db.task.create({
      data: {
        teamId: data.teamId,
        title: encryptText(data.title, data.teamId),
        notes: encryptOptional(data.notes, data.teamId),
        priority: data.priority,
        assigneeId: data.assigneeId ?? null,
        ideaId: data.projectId ?? null,
        createdById: ctx.user.id,
      },
      select: { id: true },
    });
    await audit(ctx, { teamId: data.teamId, action: "task.created", entityType: "Task", entityId: task.id });
    revalidatePath("/dashboard", "layout");
    return { id: task.id };
  });
}

export async function updateTask(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId, title, notes, projectId } = updateTaskSchema.parse(input);
    await requireMembership(teamId, ctx.user.id);
    await assertProject(teamId, projectId);
    const { count } = await db.task.updateMany({
      where: { id: itemId, teamId },
      data: {
        ...(title !== undefined && { title: encryptText(title, teamId) }),
        ...(notes !== undefined && { notes: encryptOptional(notes, teamId) }),
        ...(projectId !== undefined && { ideaId: projectId }),
      },
    });
    return touched(count);
  });
}

export async function setTaskStatus(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId, status } = z
      .strictObject({ teamId: id, itemId: id, status: taskStatusSchema })
      .parse(input);
    await requireMembership(teamId, ctx.user.id);
    const { count } = await db.task.updateMany({
      where: { id: itemId, teamId },
      data: {
        status,
        completedAt: status === "DONE" ? new Date() : null,
        ...(status !== "IN_PROGRESS" && { isFocused: false }),
      },
    });
    if (status === "DONE" && count) {
      await audit(ctx, { teamId, action: "task.done", entityType: "Task", entityId: itemId });
    }
    return touched(count);
  });
}

export async function assignTask(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId, assigneeId } = z
      .strictObject({ teamId: id, itemId: id, assigneeId: id.nullable() })
      .parse(input);
    await requireMembership(teamId, ctx.user.id);
    await assertAssignee(teamId, assigneeId);
    const { count } = await db.task.updateMany({
      where: { id: itemId, teamId },
      // A new owner starts unfocused; focus is claimed, never assigned.
      data: { assigneeId, isFocused: false },
    });
    return touched(count);
  });
}

export async function setTaskPriority(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId, priority } = z
      .strictObject({ teamId: id, itemId: id, priority: prioritySchema })
      .parse(input);
    await requireMembership(teamId, ctx.user.id);
    const { count } = await db.task.updateMany({ where: { id: itemId, teamId }, data: { priority } });
    return touched(count);
  });
}

/** "Start Working": claim the task into the Live Focus dock (one focus per person per team). */
export async function startFocus(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId } = teamScoped.parse(input);
    await requireMembership(teamId, ctx.user.id);
    const task = await db.task.findFirst({
      where: { id: itemId, teamId },
      select: { assigneeId: true, status: true, assignee: { select: { username: true } } },
    });
    if (!task) throw new ActionError("Task not found.");
    if (task.status === "DONE") throw new ActionError("That task is already shipped.");
    if (task.assigneeId && task.assigneeId !== ctx.user.id) {
      throw new ActionError(`Assigned to @${task.assignee?.username}. Reassign it to yourself first.`);
    }
    await db.$transaction([
      db.task.updateMany({
        where: { teamId, assigneeId: ctx.user.id, isFocused: true },
        data: { isFocused: false },
      }),
      db.task.updateMany({
        where: { id: itemId, teamId, OR: [{ assigneeId: null }, { assigneeId: ctx.user.id }] },
        data: { assigneeId: ctx.user.id, status: "IN_PROGRESS", isFocused: true },
      }),
    ]);
    await audit(ctx, { teamId, action: "task.focus", entityType: "Task", entityId: itemId });
    return touched(1);
  });
}

export async function stopFocus(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId } = teamScoped.parse(input);
    await requireMembership(teamId, ctx.user.id);
    const { count } = await db.task.updateMany({
      where: { id: itemId, teamId, assigneeId: ctx.user.id },
      data: { isFocused: false },
    });
    return touched(count);
  });
}

/** Permanently deletes a task. Its creator, its assignee, or a team owner/admin may do it. */
export async function deleteTask(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { teamId, itemId } = teamScoped.parse(input);
    const me = await requireMembership(teamId, ctx.user.id);
    const task = await db.task.findFirst({ where: { id: itemId, teamId }, select: { createdById: true, assigneeId: true } });
    if (!task) throw new ActionError("Task not found.");
    const mine = task.createdById === ctx.user.id || task.assigneeId === ctx.user.id;
    if (!mine && me.role === "MEMBER") throw new ActionError("Only its creator, its assignee or an admin can delete this task.");
    await db.task.deleteMany({ where: { id: itemId, teamId } });
    await audit(ctx, { teamId, action: "task.deleted", entityType: "Task", entityId: itemId });
    revalidatePath("/dashboard", "layout");
    return null;
  });
}
