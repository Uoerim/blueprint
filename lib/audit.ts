import "server-only";
import type { SiteRole } from "./site-roles";
import { db } from "./db";
import { logServerError } from "./errors";
import { anonymizeIp } from "./request";

/**
 * Every event the audit trail can record. A closed list, so a typo can't
 * invent a new kind of event and the admin views can rely on the names.
 */
export type AuditAction =
  // Accounts
  | "user.onboarded"
  // Site staff (admin panel and the site-role CLI)
  | "admin.user.suspended"
  | "admin.user.unsuspended"
  | "admin.user.signed_out"
  | `admin.user.role.${SiteRole}`
  | "admin.user.renamed"
  | "admin.user.deleted"
  | "admin.team.deleted"
  | "admin.report.resolved"
  | "admin.report.reopened"
  | "admin.report.rejected"
  | "admin.report.deleted"
  | "admin.report.purged"
  | `cli.site.role.${SiteRole}`
  | "cli.user.unsuspended"
  // Teams, membership and roles
  | "team.created"
  | "team.updated"
  | "team.deleted"
  | "team.ownership.transferred"
  | "team.shipped.cleared"
  | "team.archive.emptied"
  | "invite.sent"
  | "invite.cancelled"
  | "invite.accepted"
  | "invite.declined"
  | "member.removed"
  | "member.left"
  | `member.role.${"CO_OWNER" | "MEMBER"}`
  | "member.custom_role"
  | "role.created"
  | "role.updated"
  | "role.deleted"
  // Work
  | "idea.created"
  | "idea.promoted"
  | "idea.archived"
  | "idea.restored"
  | "idea.deleted"
  | "idea.deleted.with_tasks"
  | "project.created"
  | "project.returned_to_ideas"
  | "project.imported"
  | "idea.imported"
  | "idea.updated"
  | "task.created"
  | "task.updated"
  | "task.moved"
  | "task.priority"
  | "task.assignees"
  | "task.done"
  | "task.focus"
  | "task.deleted"
  | "subtask.created"
  | "subtask.updated"
  | "subtask.done"
  | "subtask.reopened"
  | "subtask.assignees"
  | "subtask.deleted"
  | "tag.created"
  | "tag.updated"
  | "tag.deleted"
  // Support
  | "report.submitted"
  // Connect Claude
  | "agent.connected"
  | "agent.disconnected"
  | "agent.write"
  | "team.agent_access.enabled"
  | "team.agent_access.disabled"
  // Security
  | "security.rate_limited"
  | "security.agent_token_reuse";

export type AuditEntry = {
  action: AuditAction;
  entityType: string;
  entityId: string;
  teamId?: string | null;
  /** Set when the change was made through a connected Claude. */
  via?: "claude";
  /** The task and idea/project it belongs to, for project and task history. */
  taskId?: string | null;
  ideaId?: string | null;
  /** Non-content details only (a column name, which fields changed), never text. */
  detail?: string;
};

/**
 * Appends one entry to the audit trail. Entries are metadata only (who, what,
 * which record, when, from which network), never the content of ideas or
 * tasks. The actor's @username is copied in so the trail stays readable after
 * a rename or account deletion, and the IP is shortened to its network.
 * The table is append-only: the Prisma client refuses updates and deletes
 * (lib/prisma.ts) and so does the database itself (a trigger). Failures are
 * logged, never thrown, so the audit trail can't break the action it records.
 */
export async function writeAudit(actor: { id: string; username: string | null }, ip: string, entry: AuditEntry) {
  try {
    await db.auditLog.create({
      data: {
        ...entry,
        teamId: entry.teamId ?? null,
        via: entry.via ?? null,
        userId: actor.id,
        actorUsername: actor.username,
        ipAddress: anonymizeIp(ip),
      },
    });
  } catch (e) {
    logServerError("audit", e);
  }
}
