/**
 * Team-level permissions. Shared by server actions (which enforce them) and
 * client components (which only use them to hide controls).
 *
 *   OWNER     everything
 *   CO_OWNER  everything except deleting the team or projects, transferring
 *             ownership, and making or removing co-owners
 *   MEMBER    the permissions of their custom role, or DEFAULT_MEMBER if none
 *
 * Every member can always: see the team, spark ideas, edit and remove their own
 * ideas, and work and finish tasks and subtasks assigned to them.
 */

export type TeamRole = "OWNER" | "CO_OWNER" | "MEMBER";

/** Permissions a custom role can grant, in the order the editor shows them. */
export const GRANTABLE = [
  "ideas.create",
  "ideas.manage",
  "tags.manage",
  "projects.create",
  "projects.edit",
  "projects.archive",
  "tasks.create",
  "tasks.edit",
  "tasks.status",
  "tasks.delete",
  "tasks.viewPrivate",
  "members.invite",
  "members.manage",
  "team.edit",
  "team.cleanup",
] as const;
export type Grantable = (typeof GRANTABLE)[number];

/** Never grantable to custom roles. */
export type Reserved =
  | "roles.manage" // owner and co-owners
  | "projects.delete" // owner only
  | "team.delete" // owner only
  | "members.coOwner"; // owner only: make/unmake co-owners, transfer ownership
export type TeamPermission = Grantable | Reserved;

export const PERMISSION_INFO: Record<Grantable, { label: string; note: string; group: string }> = {
  "ideas.create": { group: "Ideas", label: "Capture ideas", note: "Add ideas to the vault." },
  "ideas.manage": { group: "Ideas", label: "Manage all ideas", note: "Edit, archive and delete anyone's ideas." },
  "tags.manage": { group: "Ideas", label: "Manage tags", note: "Add, rename, recolour and delete the team's tags." },
  "projects.create": { group: "Projects", label: "Create projects", note: "Start projects and promote ideas into them." },
  "projects.edit": { group: "Projects", label: "Edit projects", note: "Change any project's name and description." },
  "projects.archive": { group: "Projects", label: "Archive projects", note: "Archive and restore projects, or move them back to ideas." },
  "tasks.create": { group: "Tasks", label: "Create tasks", note: "Add tasks and subtasks, choose assignees and visibility." },
  "tasks.edit": { group: "Tasks", label: "Edit any task", note: "Change details, assignees, priority, visibility and subtasks." },
  "tasks.status": { group: "Tasks", label: "Move any task", note: "Start, move and finish tasks they aren't assigned to." },
  "tasks.delete": { group: "Tasks", label: "Delete tasks", note: "Permanently delete tasks." },
  "tasks.viewPrivate": { group: "Tasks", label: "See private tasks", note: "See tasks that are visible to their assignees only." },
  "members.invite": { group: "People", label: "Invite people", note: "Search for people and invite them to the team." },
  "members.manage": { group: "People", label: "Manage members", note: "Remove members and give them roles they could grant." },
  "team.edit": { group: "Team", label: "Edit team details", note: "Change the team name and description." },
  "team.cleanup": { group: "Team", label: "Clean up", note: "Clear shipped tasks and empty the archive." },
};

/** What a member without a custom role can do (on top of the always-on basics). */
export const DEFAULT_MEMBER: readonly Grantable[] = ["ideas.create"];

const CO_OWNER: readonly TeamPermission[] = [...GRANTABLE, "roles.manage"];
const OWNER: readonly TeamPermission[] = [...CO_OWNER, "projects.delete", "team.delete", "members.coOwner"];

export const isGrantable = (p: unknown): p is Grantable => GRANTABLE.includes(p as Grantable);

/** The effective permission list for a membership. Unknown strings in a custom role are ignored. */
export function permissionsFor(role: TeamRole, custom: readonly string[] | null | undefined): TeamPermission[] {
  if (role === "OWNER") return [...OWNER];
  if (role === "CO_OWNER") return [...CO_OWNER];
  return custom ? custom.filter(isGrantable) : [...DEFAULT_MEMBER];
}

export const ROLE_RANK: Record<TeamRole, number> = { OWNER: 2, CO_OWNER: 1, MEMBER: 0 };

export const ROLE_NAME: Record<TeamRole, string> = { OWNER: "Owner", CO_OWNER: "Co-owner", MEMBER: "Member" };


/* ── Task-level rules, used identically on both sides ─────────────────────── */

export type TaskAccessFacts = {
  me: string;
  perms: ReadonlySet<TeamPermission> | readonly TeamPermission[];
  createdById: string;
  assigneeIds: readonly string[];
  visibility: "TEAM" | "ASSIGNEES";
  /** People assigned to any of the task's subtasks. */
  subtaskAssigneeIds?: readonly string[];
};

const has = (perms: TaskAccessFacts["perms"], p: TeamPermission) =>
  perms instanceof Set ? perms.has(p) : (perms as readonly TeamPermission[]).includes(p);

export function canSeeTask(t: TaskAccessFacts) {
  return (
    t.visibility === "TEAM" ||
    has(t.perms, "tasks.viewPrivate") ||
    t.createdById === t.me ||
    t.assigneeIds.includes(t.me) ||
    !!t.subtaskAssigneeIds?.includes(t.me)
  );
}

/** Change details, assignees, priority, visibility and subtasks. Creators keep editing what they made. */
export function canEditTask(t: TaskAccessFacts) {
  return has(t.perms, "tasks.edit") || (t.createdById === t.me && has(t.perms, "tasks.create"));
}

/** Move and finish: assignees always can; others need tasks.status (or edit rights). */
export function canMoveTask(t: TaskAccessFacts) {
  return t.assigneeIds.includes(t.me) || has(t.perms, "tasks.status") || canEditTask(t);
}

export function canDeleteTask(t: TaskAccessFacts) {
  return has(t.perms, "tasks.delete") || (t.createdById === t.me && has(t.perms, "tasks.create"));
}

/** Ticking a subtask: its assignees, the task's assignees when the subtask has none, or anyone who can move the task. */
export function canToggleSubtask(t: TaskAccessFacts, subtaskAssigneeIds: readonly string[]) {
  if (subtaskAssigneeIds.includes(t.me)) return true;
  if (!subtaskAssigneeIds.length && t.assigneeIds.includes(t.me)) return true;
  return has(t.perms, "tasks.status") || canEditTask(t);
}
