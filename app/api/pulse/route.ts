import { guardRead, json, withErrors } from "@/lib/api";
import { db } from "@/lib/db";
import { slugSchema } from "@/lib/validations";

/**
 * The live change-check. Returns two timestamps: when anything last changed in
 * the team (only if the caller is a member; on the home page, any of their
 * teams) and when the caller's notifications
 * last changed. Tabs compare them and re-fetch only when one moves.
 */
export const GET = withErrors(async (req: Request): Promise<Response> => {
  const guard = await guardRead(req, "pulse");
  if (guard.error) return guard.error;

  const slug = slugSchema.safeParse(new URL(req.url).searchParams.get("team") ?? "");
  let team: number | null = null;
  if (slug.success) {
    const t = await db.team.findFirst({
      where: { slug: slug.data, members: { some: { userId: guard.viewer.id } } },
      select: { activityAt: true },
    });
    team = t ? t.activityAt.getTime() : null;
  } else {
    // The dashboard home: the latest change across all of the viewer's teams.
    const all = await db.team.aggregate({ where: { members: { some: { userId: guard.viewer.id } } }, _max: { activityAt: true } });
    team = all._max.activityAt?.getTime() ?? null;
  }
  return json({ team, inbox: guard.viewer.inboxAt.getTime() }, 200, guard.headers);
});
