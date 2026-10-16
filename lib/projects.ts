import "server-only";
import { db } from "./db";

/**
 * Moves a project in Execution back to the idea vault and resets its progress,
 * all in one transaction: the idea goes back to VAULT, every task returns to
 * Backlog with no completion, subtasks are unticked and live focus stops.
 * Tasks themselves (titles, assignees, notes) are kept. Scoped to the verified
 * team. Nothing is touched, and it returns false, unless the project was in
 * Execution at that moment.
 */
export async function returnProjectToIdeas(teamId: string, ideaId: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const moved = await tx.idea.updateMany({ where: { id: ideaId, teamId, status: "PROMOTED" }, data: { status: "VAULT" } });
    if (moved.count !== 1) return false;
    await tx.task.updateMany({ where: { teamId, ideaId }, data: { status: "TODO", completedAt: null, completedById: null } });
    await tx.subtask.updateMany({ where: { teamId, task: { ideaId } }, data: { done: false, completedAt: null } });
    await tx.taskAssignee.updateMany({ where: { teamId, task: { ideaId }, focusedAt: { not: null } }, data: { focusedAt: null } });
    return true;
  });
}
