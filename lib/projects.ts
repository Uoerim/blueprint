import "server-only";
import { LIMITS } from "./constants";
import { encryptOptional, encryptText } from "./crypto";
import { db } from "./db";
import type { ImportPlan } from "./validations";

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

/**
 * Creates a project with its tasks and subtasks from an imported plan, in one
 * transaction (all of it, or none). Texts are encrypted with the team's key.
 * Tags the team doesn't have are dropped, since an AI may invent some.
 * The caller checks permissions and validates the plan first.
 */
export async function createProjectFromPlan(teamId: string, userId: string, plan: ImportPlan) {
  const known = new Set((await db.teamTag.findMany({ where: { teamId }, select: { name: true } })).map((t) => t.name));
  const keep = (tags: string[]) =>
    [...new Set(tags.map((t) => t.trim().toLowerCase().replace(/^#/, "")).filter((t) => known.has(t)))].slice(0, LIMITS.tagsPerIdea);

  return db.$transaction(
    async (tx) => {
      const idea = await tx.idea.create({
        data: {
          teamId,
          title: encryptText(plan.title, teamId),
          description: encryptOptional(plan.description, teamId),
          tags: keep(plan.tags),
          status: "PROMOTED",
          createdById: userId,
        },
        select: { id: true },
      });
      for (const t of plan.tasks) {
        await tx.task.create({
          data: {
            teamId,
            ideaId: idea.id,
            title: encryptText(t.title, teamId),
            description: encryptOptional(t.description, teamId),
            notes: encryptOptional(t.notes, teamId),
            priority: t.priority,
            tags: keep(t.tags),
            createdById: userId,
            subtasks: {
              create: t.subtasks.map((raw, position) => {
                const sub = typeof raw === "string" ? { title: raw, description: undefined } : raw;
                return {
                  teamId,
                  title: encryptText(sub.title, teamId),
                  description: encryptOptional(sub.description, teamId),
                  position,
                  createdById: userId,
                };
              }),
            },
          },
        });
      }
      return idea;
    },
    { timeout: 20_000 },
  );
}
