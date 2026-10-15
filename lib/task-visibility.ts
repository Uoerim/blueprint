import "server-only";
import type { Prisma } from "@prisma/client";

/**
 * The tasks a member may see, as a Prisma filter, so private tasks are never
 * even loaded for people who can't see them. Mirrors canSeeTask() in
 * lib/team-permissions.ts.
 */
export function visibleTasks(teamId: string, userId: string, canViewPrivate: boolean): Prisma.TaskWhereInput {
  if (canViewPrivate) return { teamId };
  return {
    teamId,
    OR: [
      { visibility: "TEAM" },
      { createdById: userId },
      { assignees: { some: { userId } } },
      { subtasks: { some: { assignees: { some: { userId } } } } },
    ],
  };
}
