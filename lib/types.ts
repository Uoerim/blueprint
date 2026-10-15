export type Viewer = { id: string; username: string; accentColor: string; displayName: string | null };

export type TeamSummary = { id: string; name: string; slug: string; role: "OWNER" | "ADMIN" | "MEMBER" };

export type IncomingInvite = {
  id: string;
  createdAt: string;
  team: { name: string; slug: string };
  inviter: { username: string; accentColor: string };
};

export type MemberDTO = {
  userId: string;
  username: string;
  displayName: string | null;
  accentColor: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
};

export type IdeaDTO = {
  id: string;
  title: string;
  description: string | null;
  /** Project scratchpad (only meaningful once promoted). */
  notes: string | null;
  tags: string[];
  status: "VAULT" | "PROMOTED" | "ARCHIVED";
  sparksCount: number;
  sparkedByMe: boolean;
  authorId: string;
  createdAt: string;
  taskCount: number;
  doneCount: number;
};

export type TaskStatus = "TODO" | "READY" | "IN_PROGRESS" | "DONE";
export type Priority = "LOW" | "MEDIUM" | "HIGH";

export type TaskDTO = {
  id: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  priority: Priority;
  isFocused: boolean;
  assigneeId: string | null;
  idea: { id: string; title: string } | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OutgoingInvite = { id: string; username: string; accentColor: string; createdAt: string };
