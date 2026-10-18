"use server";

import { z } from "zod";
import { runAction } from "@/lib/action";
import { loadActivity } from "@/lib/activity-log";
import { ActionError } from "@/lib/auth";
import { db } from "@/lib/db";
import { loadTask } from "@/lib/ops/tasks";
import { requireTeamAccess } from "@/lib/team-access";
import { id } from "@/lib/validations";

const activitySchema = z.strictObject({
  teamId: id,
  ideaId: id.optional(),
  taskId: id.optional(),
  claudeOnly: z.boolean().optional(),
  before: z.iso.datetime().optional(),
});

/**
 * One page of a team's, project's or task's activity. Members only; a task's
 * history needs the viewer to be able to see that task, and entries about
 * tasks they can't see are left out everywhere (lib/activity-log.ts).
 */
export async function getActivity(input: unknown) {
  return runAction({ tier: "read" }, async (ctx) => {
    const { teamId, ideaId, taskId, claudeOnly, before } = activitySchema.parse(input);
    const access = await requireTeamAccess(teamId, ctx.user.id);
    if (taskId) await loadTask(access, taskId);
    if (ideaId && !(await db.idea.findFirst({ where: { id: ideaId, teamId }, select: { id: true } }))) throw new ActionError("Not found.");
    return loadActivity(access, { ideaId, taskId, claudeOnly, before: before ? new Date(before) : undefined });
  });
}
