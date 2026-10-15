import type { TeamRole } from "./team-permissions";

export type Viewer = { id: string; username: string; accentColor: string; displayName: string | null };

export type TeamSummary = { id: string; name: string; slug: string; role: TeamRole };

export type IncomingInvite = {
  id: string;
  createdAt: string;
  team: { name: string; slug: string };
  inviter: { username: string; accentColor: string };
};

export type CustomRoleDTO = { id: string; name: string; color: string; permissions: string[] };

export type MemberDTO = {
  userId: string;
  username: string;
  displayName: string | null;
  accentColor: string;
  role: TeamRole;
  customRole: { id: string; name: string; color: string } | null;
};

export type IdeaDTO = {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  status: "VAULT" | "PROMOTED" | "ARCHIVED";
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
  done: boolean;
  assigneeIds: string[];
  completedAt: string | null;
};

export type TaskDTO = {
  id: string;
  title: string;
  description: string | null;
  notes: string | null;
  status: TaskStatus;
  priority: Priority;
  visibility: Visibility;
  createdById: string;
  assigneeIds: string[];
  /** Assignees currently working on it (Live focus), with when they started. */
  focus: { userId: string; since: string }[];
  subtasks: SubtaskDTO[];
  idea: { id: string; title: string } | null;
  completedAt: string | null;
  completedById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OutgoingInvite = { id: string; username: string; accentColor: string; createdAt: string };
