"use server";

import { runAction } from "@/lib/action";
import { db } from "@/lib/db";

export type Usage = {
  teams: number;
  owned: number;
  ideas: number;
  projects: number;
  created: number;
  shipped: number;
};

/** The viewer's own counts, for the Usage page in the account window. */
export async function getUsage() {
  return runAction({ tier: "global" }, async ({ user }): Promise<Usage> => {
    const [teams, owned, ideas, projects, created, shipped] = await Promise.all([
      db.teamMember.count({ where: { userId: user.id } }),
      db.teamMember.count({ where: { userId: user.id, role: "OWNER" } }),
      db.idea.count({ where: { createdById: user.id } }),
      db.idea.count({ where: { createdById: user.id, status: "PROMOTED" } }),
      db.task.count({ where: { createdById: user.id } }),
      db.task.count({ where: { completedById: user.id, status: "DONE" } }),
    ]);
    return { teams, owned, ideas, projects, created, shipped };
  });
}
