import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "./db";

/*
 * Live updates use a cheap change-check: every write stamps `activityAt` on the
 * team (or `inboxAt` on a person), and open tabs poll /api/pulse for those two
 * timestamps every few seconds. Only when one moves does a tab re-fetch data.
 */

/** Something inside the team changed: stamp it and drop cached dashboard renders. */
export async function teamChanged(teamId: string) {
  await db.team.updateMany({ where: { id: teamId }, data: { activityAt: new Date() } });
  revalidatePath("/dashboard", "layout");
}

/** Something landed in these people's notifications (invites). */
export async function inboxChanged(userIds: readonly string[]) {
  if (!userIds.length) return;
  await db.user.updateMany({ where: { id: { in: [...userIds] } }, data: { inboxAt: new Date() } });
}
