import "server-only";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import type { Ctx } from "@/lib/action";
import { writeAudit } from "@/lib/audit";
import { ActionError } from "@/lib/auth";
import { LIMITS } from "@/lib/constants";
import { decryptOptional, decryptText } from "@/lib/crypto";
import { db } from "@/lib/db";
import type { Scope } from "@/lib/oauth";
import type { AgentAuth } from "@/lib/oauth-tokens";
import { opCreateIdea } from "@/lib/ops/ideas";
import { factsOf, opCreateSubtask, opCreateTask, opSetTaskStatus, opToggleSubtask, opUpdateTask } from "@/lib/ops/tasks";
import { requireTeamAccess, type TeamAccess } from "@/lib/team-access";
import { canEditTask, canMoveTask, canSeeTask, canToggleSubtask } from "@/lib/team-permissions";
import { visibleTasks } from "@/lib/task-visibility";
import { id } from "@/lib/validations";

/*
 * What Claude can do in Blueprint. Every tool:
 * - works only in teams the person picked when connecting, that they're still
 *   in, and whose owner still allows Claude (checked on every call);
 * - reads only what the person can see (the same visibility filter the app
 *   uses) and changes things only through the app's own operations
 *   (lib/ops), so the person's role and every task rule apply unchanged;
 * - needs the scope it's listed under; there are no delete, member, role,
 *   invite or settings tools at all.
 * Changes are recorded in the audit trail as the person's, marked "via claude".
 */

export type ToolCtx = AgentAuth & { ip: string };

type Tool = {
  name: string;
  title: string;
  description: string;
  scope: Scope;
  input: z.ZodType;
  readOnly: boolean;
  run: (ctx: ToolCtx, args: never) => Promise<unknown>;
};

const team = z.string().min(1).max(64).describe("The team's slug (from list_teams).");
const STATUS = { backlog: "TODO", ready: "READY", in_progress: "IN_PROGRESS", done: "DONE" } as const;
const STATUS_NAME = { TODO: "backlog", READY: "ready", IN_PROGRESS: "in_progress", DONE: "done" } as const;
const priority = z.enum(["LOW", "MEDIUM", "HIGH"]);
const tagList = z.array(z.string().max(24)).max(LIMITS.tagsPerTask).describe("Team tag names, without #. Only tags the team has.");

/** Resolves a team Claude may use right now, with the person's fresh permissions there. */
async function openTeam(ctx: ToolCtx, ref: string): Promise<{ id: string; slug: string; name: string; access: TeamAccess }> {
  const t = await db.team.findFirst({
    where: { OR: [{ slug: ref.toLowerCase() }, { id: ref }], id: { in: [...ctx.grant.teamIds] }, agentAccess: true },
    select: { id: true, slug: true, name: true },
  });
  if (!t) throw new ActionError(`No team "${ref}" that Claude can use. Call list_teams to see the teams available.`);
  try {
    return { ...t, access: await requireTeamAccess(t.id, ctx.user.id) };
  } catch {
    throw new ActionError(`No team "${ref}" that Claude can use. Call list_teams to see the teams available.`);
  }
}

const opCtx = (ctx: ToolCtx): Ctx => ({ user: ctx.user, ip: ctx.ip, via: "claude" });

/** Every change made through Claude gets its own audit entry (the person, the target, "via claude"). */
const recordChange = (ctx: ToolCtx, teamId: string, entityType: "Task" | "Subtask" | "Idea", entityId: string) =>
  writeAudit(ctx.user, ctx.ip, { action: "agent.write", entityType, entityId, teamId, via: "claude" });
const usernames = (rows: { user: { username: string | null } }[]) => rows.map((r) => r.user.username).filter(Boolean);
const clip = (s: string | null | undefined, n: number) => (s && s.length > n ? `${s.slice(0, n)}…` : s ?? null);

const taskSummary = {
  id: true,
  title: true,
  status: true,
  priority: true,
  tags: true,
  idea: { select: { id: true, title: true, status: true } },
  assignees: { select: { user: { select: { username: true } } } },
  subtasks: { select: { done: true } },
} satisfies Prisma.TaskSelect;

function summarize(t: Prisma.TaskGetPayload<{ select: typeof taskSummary }>, teamId: string) {
  return {
    id: t.id,
    title: decryptText(t.title, teamId),
    status: STATUS_NAME[t.status],
    priority: t.priority,
    tags: t.tags,
    project: t.idea ? { id: t.idea.id, title: decryptText(t.idea.title, teamId), is_raw_idea: t.idea.status === "VAULT" } : null,
    assignees: usernames(t.assignees),
    subtasks: `${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}`,
  };
}

const tool = <S extends z.ZodType>(t: Omit<Tool, "input" | "run"> & { input: S; run: (ctx: ToolCtx, args: z.infer<S>) => Promise<unknown> }) => t as unknown as Tool;

export const TOOLS: Tool[] = [
  tool({
    name: "list_teams",
    title: "List teams",
    description: "The Blueprint teams you can work in through Claude, with your role in each.",
    scope: "read",
    readOnly: true,
    input: z.strictObject({}),
    run: async (ctx) => {
      const rows = await db.teamMember.findMany({
        where: { userId: ctx.user.id, teamId: { in: [...ctx.grant.teamIds] }, team: { agentAccess: true } },
        select: { role: true, team: { select: { name: true, slug: true } } },
        orderBy: { joinedAt: "asc" },
      });
      return { you: `@${ctx.user.username}`, teams: rows.map((r) => ({ name: r.team.name, slug: r.team.slug, your_role: r.role.toLowerCase() })) };
    },
  }),
  tool({
    name: "list_tasks",
    title: "List tasks",
    description: "Tasks in a team that you can see. By default only tasks assigned to you that aren't done.",
    scope: "read",
    readOnly: true,
    input: z.strictObject({
      team,
      assigned: z.enum(["me", "anyone"]).default("me").describe("'me' for your tasks, 'anyone' for every task you can see."),
      status: z.enum(["backlog", "ready", "in_progress", "done", "open"]).default("open").describe("'open' means everything except done."),
      project_id: id.optional().describe("Only tasks of this project or idea."),
      limit: z.number().int().min(1).max(100).default(50),
    }),
    run: async (ctx, a) => {
      const t = await openTeam(ctx, a.team);
      const where: Prisma.TaskWhereInput = {
        AND: [
          visibleTasks(t.id, ctx.user.id, t.access.can("tasks.viewPrivate")),
          a.assigned === "me" ? { assignees: { some: { userId: ctx.user.id } } } : {},
          a.status === "open" ? { status: { not: "DONE" } } : { status: STATUS[a.status] },
          a.project_id ? { ideaId: a.project_id } : {},
        ],
      };
      const rows = await db.task.findMany({ where, select: taskSummary, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: a.limit });
      return { team: t.slug, count: rows.length, tasks: rows.map((r) => summarize(r, t.id)) };
    },
  }),
  tool({
    name: "get_task",
    title: "Read a task",
    description: "Everything about one task: description, notes, subtasks, assignees, and what you're allowed to change.",
    scope: "read",
    readOnly: true,
    input: z.strictObject({ team, task_id: id }),
    run: async (ctx, a) => {
      const t = await openTeam(ctx, a.team);
      const row = await db.task.findFirst({
        where: { id: a.task_id, teamId: t.id },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          tags: true,
          idea: { select: { id: true, title: true, status: true } },
          assignees: { select: { userId: true, user: { select: { username: true } } } },
          description: true,
          notes: true,
          visibility: true,
          createdById: true,
          createdBy: { select: { username: true } },
          subtasks: {
            select: { id: true, title: true, description: true, done: true, assignees: { select: { userId: true, user: { select: { username: true } } } } },
            orderBy: { position: "asc" },
          },
        },
      });
      const facts = row && factsOf(t.access, { ...row, subtasks: row.subtasks.map((s) => ({ assignees: s.assignees })) });
      if (!row || !facts || !canSeeTask(facts)) throw new ActionError("Task not found.");
      return {
        ...summarize({ ...row, subtasks: row.subtasks }, t.id),
        description: decryptOptional(row.description, t.id),
        notes: decryptOptional(row.notes, t.id),
        visibility: row.visibility === "TEAM" ? "team" : "assignees_only",
        created_by: row.createdBy.username,
        subtasks: row.subtasks.map((s) => ({
          id: s.id,
          title: decryptText(s.title, t.id),
          description: decryptOptional(s.description, t.id),
          done: s.done,
          assignees: usernames(s.assignees),
          you_can_tick: canToggleSubtask(facts, s.assignees.map((x) => x.userId)),
        })),
        you_can: { edit: canEditTask(facts), move: canMoveTask(facts) },
      };
    },
  }),
  tool({
    name: "list_ideas",
    title: "List ideas and projects",
    description: "Raw ideas in the team's vault and projects in execution (archived ones are left out).",
    scope: "read",
    readOnly: true,
    input: z.strictObject({ team, kind: z.enum(["ideas", "projects", "all"]).default("all") }),
    run: async (ctx, a) => {
      const t = await openTeam(ctx, a.team);
      const status = a.kind === "ideas" ? (["VAULT"] as const) : a.kind === "projects" ? (["PROMOTED"] as const) : (["VAULT", "PROMOTED"] as const);
      const rows = await db.idea.findMany({
        where: { teamId: t.id, status: { in: [...status] } },
        select: { id: true, title: true, description: true, status: true, sparksCount: true, createdBy: { select: { username: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      return {
        team: t.slug,
        items: rows.map((r) => ({
          id: r.id,
          kind: r.status === "VAULT" ? "idea" : "project",
          title: decryptText(r.title, t.id),
          description: clip(decryptOptional(r.description, t.id), 300),
          sparks: r.sparksCount,
          by: r.createdBy.username,
        })),
      };
    },
  }),
  tool({
    name: "get_idea",
    title: "Read an idea or project",
    description: "One idea or project with its full description and the tasks in it that you can see.",
    scope: "read",
    readOnly: true,
    input: z.strictObject({ team, idea_id: id }),
    run: async (ctx, a) => {
      const t = await openTeam(ctx, a.team);
      const idea = await db.idea.findFirst({
        where: { id: a.idea_id, teamId: t.id, status: { in: ["VAULT", "PROMOTED"] } },
        select: { id: true, title: true, description: true, status: true, sparksCount: true, createdBy: { select: { username: true } } },
      });
      if (!idea) throw new ActionError("Idea or project not found.");
      const tasks = await db.task.findMany({
        where: { AND: [visibleTasks(t.id, ctx.user.id, t.access.can("tasks.viewPrivate")), { ideaId: idea.id }] },
        select: taskSummary,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 100,
      });
      return {
        id: idea.id,
        kind: idea.status === "VAULT" ? "idea" : "project",
        title: decryptText(idea.title, t.id),
        description: decryptOptional(idea.description, t.id),
        sparks: idea.sparksCount,
        by: idea.createdBy.username,
        tasks: tasks.map((r) => summarize(r, t.id)),
      };
    },
  }),
  tool({
    name: "update_task",
    title: "Edit a task",
    description: "Change a task's title, description, notes, priority or tags. Only fields you pass are changed.",
    scope: "tasks",
    readOnly: false,
    input: z.strictObject({
      team,
      task_id: id,
      title: z.string().min(1).max(LIMITS.title).optional(),
      description: z.string().max(LIMITS.description).optional().describe("Empty string clears it."),
      notes: z.string().max(LIMITS.notes).optional().describe("Empty string clears it."),
      priority: priority.optional(),
      tags: tagList.optional(),
    }),
    run: async (ctx, a) => {
      const t = await openTeam(ctx, a.team);
      const changes = Object.fromEntries(
        Object.entries({ title: a.title, description: a.description, notes: a.notes, priority: a.priority, tags: a.tags }).filter(([, v]) => v !== undefined),
      );
      if (!Object.keys(changes).length) throw new ActionError("Pass at least one field to change.");
      await opUpdateTask(opCtx(ctx), { teamId: t.id, itemId: a.task_id, ...changes });
      await recordChange(ctx, t.id, "Task", a.task_id);
      return { ok: true, task_id: a.task_id };
    },
  }),
  tool({
    name: "set_task_status",
    title: "Move a task",
    description: "Move a task to backlog, ready, in_progress or done. Usually only people assigned to the task can move it.",
    scope: "tasks",
    readOnly: false,
    input: z.strictObject({ team, task_id: id, status: z.enum(["backlog", "ready", "in_progress", "done"]) }),
    run: async (ctx, a) => {
      const t = await openTeam(ctx, a.team);
      await opSetTaskStatus(opCtx(ctx), { teamId: t.id, itemId: a.task_id, status: STATUS[a.status] });
      await recordChange(ctx, t.id, "Task", a.task_id);
      return { ok: true, task_id: a.task_id, status: a.status };
    },
  }),
  tool({
    name: "add_subtasks",
    title: "Add subtasks",
    description: "Add up to 20 checklist items to a task, in order.",
    scope: "tasks",
    readOnly: false,
    input: z.strictObject({
      team,
      task_id: id,
      subtasks: z
        .array(z.strictObject({ title: z.string().min(1).max(LIMITS.title), description: z.string().max(LIMITS.description).optional() }))
        .min(1)
        .max(20),
    }),
    run: async (ctx, a) => {
      const t = await openTeam(ctx, a.team);
      const ids: string[] = [];
      for (const s of a.subtasks) {
        const res = await opCreateSubtask(opCtx(ctx), { teamId: t.id, taskId: a.task_id, title: s.title, description: s.description });
        ids.push(res.id);
      }
      await recordChange(ctx, t.id, "Task", a.task_id);
      return { ok: true, task_id: a.task_id, subtask_ids: ids };
    },
  }),
  tool({
    name: "set_subtask_done",
    title: "Tick a subtask",
    description: "Mark a subtask done or not done. Only people allowed to tick it can.",
    scope: "tasks",
    readOnly: false,
    input: z.strictObject({ team, subtask_id: id, done: z.boolean() }),
    run: async (ctx, a) => {
      const t = await openTeam(ctx, a.team);
      await opToggleSubtask(opCtx(ctx), { teamId: t.id, itemId: a.subtask_id, done: a.done });
      await recordChange(ctx, t.id, "Subtask", a.subtask_id);
      return { ok: true, subtask_id: a.subtask_id, done: a.done };
    },
  }),
  tool({
    name: "create_task",
    title: "Create a task",
    description: "Create a task in the team, optionally inside a project or idea. Assigned to you unless you say otherwise.",
    scope: "create",
    readOnly: false,
    input: z.strictObject({
      team,
      title: z.string().min(1).max(LIMITS.title),
      description: z.string().max(LIMITS.description).optional(),
      notes: z.string().max(LIMITS.notes).optional(),
      priority: priority.default("MEDIUM"),
      tags: tagList.default([]),
      project_id: id.optional().describe("A project or raw idea to put it in."),
      assign_to_me: z.boolean().default(true),
    }),
    run: async (ctx, a) => {
      const t = await openTeam(ctx, a.team);
      const res = await opCreateTask(opCtx(ctx), {
        teamId: t.id,
        title: a.title,
        description: a.description,
        notes: a.notes,
        priority: a.priority,
        tags: a.tags,
        projectId: a.project_id ?? null,
        assigneeIds: a.assign_to_me ? [ctx.user.id] : [],
      });
      await recordChange(ctx, t.id, "Task", res.id);
      return { ok: true, task_id: res.id };
    },
  }),
  tool({
    name: "capture_idea",
    title: "Capture an idea",
    description: "Add a raw idea to the team's vault.",
    scope: "create",
    readOnly: false,
    input: z.strictObject({ team, title: z.string().min(1).max(LIMITS.title), description: z.string().max(LIMITS.ideaBody).optional() }),
    run: async (ctx, a) => {
      const t = await openTeam(ctx, a.team);
      const res = await opCreateIdea(opCtx(ctx), { teamId: t.id, title: a.title, description: a.description });
      await recordChange(ctx, t.id, "Idea", res.id);
      return { ok: true, idea_id: res.id };
    },
  }),
];

/** JSON Schema for a tool's input, as MCP clients expect it. */
export function inputSchema(t: Tool) {
  const schema = z.toJSONSchema(t.input, { io: "input" }) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}
