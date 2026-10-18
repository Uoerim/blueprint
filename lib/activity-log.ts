import "server-only";
import type { Prisma } from "@prisma/client";
import { TASK_COLUMNS } from "./constants";
import { decryptText } from "./crypto";
import { db } from "./db";
import type { TeamAccess } from "./team-access";
import { visibleTasks } from "./task-visibility";

/*
 * A team's activity, read from the append-only audit trail (nothing here can
 * be edited or deleted, by anyone). Shown to the team's members in team
 * settings, project settings and each task's view:
 * - only team events (never security, staff or personal entries), never IPs;
 * - entries about a task the viewer can't see are left out entirely;
 * - names and titles are looked up now (decrypted for this team), so renamed
 *   things read correctly and deleted ones say so;
 * - entries made through Claude carry via = "claude".
 */

export type ActivityItem = {
  id: string;
  at: string;
  actor: string;
  via: "claude" | null;
  verb: string;
  target: string | null;
  /** e.g. the task a subtask belongs to, or the project a task is in. */
  context: string | null;
};

const TEAM_PREFIXES = ["team.", "invite.", "member.", "role.", "idea.", "project.", "task.", "subtask.", "tag."];
const WORK_PREFIXES = ["idea.", "project.", "task.", "subtask."];
const PAGE = 30;

const COLUMN = Object.fromEntries(TASK_COLUMNS.map((c) => [c.status, c.label.toLowerCase()])) as Record<string, string>;
const FIELD: Record<string, string> = { title: "title", description: "description", notes: "notes", project: "project", priority: "priority", visibility: "visibility", tags: "tags" };

function verbFor(action: string, detail: string | null): string {
  switch (action) {
    case "idea.created": return "captured the idea";
    case "idea.updated": return `edited the ${detail?.split(",").filter(Boolean).join(" and ") || "details"} of`;
    case "idea.promoted": return "promoted to a project";
    case "idea.archived": return "archived";
    case "idea.restored": return "restored";
    case "idea.deleted": return "deleted";
    case "idea.deleted.with_tasks": return "deleted, with its tasks,";
    case "idea.imported": return "imported the idea";
    case "project.created": return "started the project";
    case "project.imported": return "imported the project";
    case "project.returned_to_ideas": return "sent back to the ideas";
    case "task.created": return "created the task";
    case "task.updated": {
      const fields = (detail ?? "").split(",").map((f) => FIELD[f]).filter(Boolean);
      return fields.length ? `edited the ${fields.join(", ")} of` : "edited";
    }
    case "task.moved": return detail === "DONE" ? "finished" : `moved to ${COLUMN[detail ?? ""] ?? "another column"}`;
    case "task.done": return "finished";
    case "task.priority": return `set ${(detail ?? "").toLowerCase() || "the"} priority on`;
    case "task.assignees": return "changed who's on";
    case "task.focus": return "started working on";
    case "task.deleted": return "deleted a task";
    case "subtask.created": return "added the subtask";
    case "subtask.updated": return "edited the subtask";
    case "subtask.done": return "ticked";
    case "subtask.reopened": return "unticked";
    case "subtask.assignees": return "changed who's on the subtask";
    case "subtask.deleted": return "removed a subtask";
    case "tag.created": return "added the tag";
    case "tag.updated": return "edited the tag";
    case "tag.deleted": return "deleted a tag";
    case "team.created": return "created the team";
    case "team.updated": return "edited the team's details";
    case "team.agent_access.enabled": return "allowed Claude in this team";
    case "team.agent_access.disabled": return "stopped Claude in this team";
    case "team.ownership.transferred": return "handed ownership to";
    case "team.shipped.cleared": return "cleared Shipped";
    case "team.archive.emptied": return "emptied the archive";
    case "invite.sent": return "invited";
    case "invite.cancelled": return "cancelled an invite";
    case "invite.accepted": return "joined the team";
    case "invite.declined": return "declined an invite";
    case "member.removed": return "removed";
    case "member.left": return "left the team";
    case "member.role.CO_OWNER": return "made a co-owner:";
    case "member.role.MEMBER": return "made a member:";
    case "member.custom_role": return "changed the role of";
    case "role.created": return "created the role";
    case "role.updated": return "edited the role";
    case "role.deleted": return "deleted a role";
    default: return action.replace(/[._]/g, " ");
  }
}

const NO_TARGET = new Set(["task.deleted", "subtask.deleted", "tag.deleted", "role.deleted", "invite.cancelled", "invite.declined", "invite.accepted", "member.left", "team.updated", "team.agent_access.enabled", "team.agent_access.disabled", "team.shipped.cleared", "team.archive.emptied", "team.created"]);

/**
 * Loads one page of activity for a team, a project/idea (ideaId) or a task
 * (taskId). The caller has already proved membership (access) and, for a task,
 * that the viewer can see it.
 */
export async function loadActivity(
  access: TeamAccess,
  opts: { ideaId?: string; taskId?: string; claudeOnly?: boolean; before?: Date },
): Promise<{ items: ActivityItem[]; more: boolean }> {
  const { teamId } = access;
  const prefixes = opts.ideaId || opts.taskId ? WORK_PREFIXES : TEAM_PREFIXES;
  const where: Prisma.AuditLogWhereInput = {
    teamId,
    OR: prefixes.map((p) => ({ action: { startsWith: p } })),
    ...(opts.ideaId && { AND: [{ OR: [{ ideaId: opts.ideaId }, { entityType: "Idea", entityId: opts.ideaId }] }] }),
    ...(opts.taskId && { AND: [{ OR: [{ taskId: opts.taskId }, { entityType: "Task", entityId: opts.taskId }] }] }),
    ...(opts.claudeOnly && { via: "claude" }),
    ...(opts.before && { createdAt: { lt: opts.before } }),
  };
  const rows = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: PAGE + 1,
    select: { id: true, userId: true, actorUsername: true, action: true, entityType: true, entityId: true, taskId: true, ideaId: true, detail: true, via: true, createdAt: true },
  });
  const more = rows.length > PAGE;
  const page = rows.slice(0, PAGE);

  const taskOf = (r: (typeof page)[number]) => r.taskId ?? (r.entityType === "Task" ? r.entityId : null);
  const ids = (type: string) => [...new Set(page.filter((r) => r.entityType === type).map((r) => r.entityId))];
  const taskIds = [...new Set(page.map(taskOf).filter((v): v is string => !!v))];
  const ideaIds = [...new Set([...page.map((r) => r.ideaId), ...ids("Idea")].filter((v): v is string => !!v))];

  const [existingTasks, visible, subtasks, ideas, users, members, invites, roles, tags] = await Promise.all([
    taskIds.length ? db.task.findMany({ where: { teamId, id: { in: taskIds } }, select: { id: true } }) : [],
    taskIds.length
      ? db.task.findMany({ where: { AND: [visibleTasks(teamId, access.userId, access.can("tasks.viewPrivate")), { id: { in: taskIds } }] }, select: { id: true, title: true } })
      : [],
    ids("Subtask").length ? db.subtask.findMany({ where: { teamId, id: { in: ids("Subtask") } }, select: { id: true, title: true } }) : [],
    ideaIds.length ? db.idea.findMany({ where: { teamId, id: { in: ideaIds } }, select: { id: true, title: true } }) : [],
    db.user.findMany({ where: { id: { in: [...new Set(page.map((r) => r.userId))] } }, select: { id: true, username: true, deletedUsername: true } }),
    ids("TeamMember").length ? db.teamMember.findMany({ where: { teamId, id: { in: ids("TeamMember") } }, select: { id: true, user: { select: { username: true } } } }) : [],
    ids("TeamInvite").length ? db.teamInvite.findMany({ where: { teamId, id: { in: ids("TeamInvite") } }, select: { id: true, invitee: { select: { username: true } } } }) : [],
    ids("TeamRole").length ? db.teamRole.findMany({ where: { teamId, id: { in: ids("TeamRole") } }, select: { id: true, name: true } }) : [],
    ids("TeamTag").length ? db.teamTag.findMany({ where: { teamId, id: { in: ids("TeamTag") } }, select: { id: true, name: true } }) : [],
  ]);

  const exists = new Set(existingTasks.map((t) => t.id));
  const taskTitle = new Map(visible.map((t) => [t.id, decryptText(t.title, teamId)]));
  const subTitle = new Map(subtasks.map((s) => [s.id, decryptText(s.title, teamId)]));
  const ideaTitle = new Map(ideas.map((i) => [i.id, decryptText(i.title, teamId)]));
  const userName = new Map(users.map((u) => [u.id, u.username ?? (u.deletedUsername ? `${u.deletedUsername} (deleted)` : "deleted account")]));
  const memberName = new Map(members.map((m) => [m.id, m.user.username ? `@${m.user.username}` : "a former member"]));
  const inviteName = new Map(invites.map((i) => [i.id, i.invitee.username ? `@${i.invitee.username}` : "someone"]));
  const roleName = new Map(roles.map((r) => [r.id, r.name]));
  const tagName = new Map(tags.map((t) => [t.id, `#${t.name}`]));

  const items: ActivityItem[] = [];
  for (const r of page) {
    const tid = taskOf(r);
    // A task the viewer can't see: leave the whole entry out (a deleted task shows without its title).
    if (tid && exists.has(tid) && !taskTitle.has(tid)) continue;
    const taskName = tid ? (taskTitle.get(tid) ?? "a deleted task") : null;
    let target: string | null = null;
    let context: string | null = null;
    switch (r.entityType) {
      case "Task":
        target = taskName;
        if (!opts.ideaId && r.ideaId) context = ideaTitle.get(r.ideaId) ?? null;
        break;
      case "Subtask":
        target = subTitle.get(r.entityId) ?? null;
        context = opts.taskId ? null : taskName;
        break;
      case "Idea":
        target = ideaTitle.get(r.entityId) ?? "a deleted idea";
        break;
      case "TeamMember":
        target = memberName.get(r.entityId) ?? "a former member";
        break;
      case "TeamInvite":
        target = inviteName.get(r.entityId) ?? null;
        break;
      case "TeamRole":
        target = roleName.get(r.entityId) ?? null;
        break;
      case "TeamTag":
        target = tagName.get(r.entityId) ?? null;
        break;
    }
    if (NO_TARGET.has(r.action)) target = null;
    // In a task's own history, "the task" is implied.
    if (opts.taskId && r.entityType === "Task") target = null;
    items.push({
      id: r.id,
      at: r.createdAt.toISOString(),
      actor: userName.get(r.userId) ?? r.actorUsername ?? "someone",
      via: r.via === "claude" ? "claude" : null,
      verb: verbFor(r.action, r.detail),
      target,
      context,
    });
  }
  return { items, more };
}
