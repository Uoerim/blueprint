import type { TeamRole } from "./team-permissions";

export type Viewer = { id: string; username: string; accentColor: string; displayName: string | null; imageUrl: string | null };

export type TeamSummary = { id: string; name: string; slug: string; role: TeamRole; favorite: boolean };

export type IncomingInvite = {
  id: string;
  createdAt: string;
  team: { name: string; slug: string };
  inviter: { username: string; accentColor: string; imageUrl: string | null };
};

export type TagDTO = { id: string; name: string; color: string };

export type CustomRoleDTO = { id: string; name: string; color: string; permissions: string[] };

export type MemberDTO = {
  userId: string;
  username: string;
  displayName: string | null;
  accentColor: string;
  imageUrl: string | null;
  role: TeamRole;
  customRole: { id: string; name: string; color: string } | null;
};

export type IdeaDTO = {
  id: string;
  title: string;
  description: string | null;
  status: "VAULT" | "PROMOTED" | "ARCHIVED";
  /** "claude" when Claude made it (permanent). */
  createdVia: "claude" | null;
  sparksCount: number;
  sparkedByMe: boolean;
  authorId: string;
  createdAt: string;
  /** Counts only include tasks the viewer can see. */
  taskCount: number;
  doneCount: number;
};

export type TaskStatus = "TODO" | "READY" | "IN_PROGRESS" | "DONE";
export type Priority = "LOW" | "MEDIUM" | "HIGH";
export type Visibility = "TEAM" | "ASSIGNEES";

export type SubtaskDTO = {
  id: string;
  title: string;
  description: string | null;
  done: boolean;
  assigneeIds: string[];
  completedAt: string | null;
  /** "claude" when Claude added it (permanent) or ticked it. */
  createdVia: "claude" | null;
  completedVia: "claude" | null;
};

export type TaskDTO = {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  status: TaskStatus;
  priority: Priority;
  visibility: Visibility;
  /** Team tag names. */
  tags: string[];
  createdById: string;
  assigneeIds: string[];
  /** Assignees currently working on it (Live focus), with when they started. */
  focus: { userId: string; since: string }[];
  subtasks: SubtaskDTO[];
  idea: { id: string; title: string } | null;
  completedAt: string | null;
  completedById: string | null;
  /** "claude" when Claude made it (permanent), or finished it. */
  createdVia: "claude" | null;
  completedVia: "claude" | null;
  /** When Claude last worked on it; never cleared once set. */
  claudeAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OutgoingInvite = { id: string; username: string; accentColor: string; imageUrl: string | null; createdAt: string };
