"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/action";
import { db } from "@/lib/db";
import { tourSchema } from "@/lib/validations";

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

/** Remembers that the viewer finished (or skipped) a guided tour, on every device. */
export async function finishTour(input: unknown) {
  return runAction({ tier: "write" }, async ({ user }) => {
    const { tour } = tourSchema.parse(input);
    if (!user.toursDone.includes(tour)) {
      await db.user.update({ where: { id: user.id }, data: { toursDone: [...new Set([...user.toursDone, tour])] } });
    }
    // Cached dashboard screens must not bring the tour back.
    revalidatePath("/dashboard", "layout");
    return null;
  });
}

/** "Take the tour": shows the welcome and team tours again. */
export async function replayTours() {
  return runAction({ tier: "write" }, async ({ user }) => {
    await db.user.update({ where: { id: user.id }, data: { toursDone: [] } });
    revalidatePath("/dashboard", "layout");
    return null;
  });
}
