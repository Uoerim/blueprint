import { guardRead, json } from "@/lib/api";
import { db } from "@/lib/db";
import { slugSchema } from "@/lib/validations";

/**
 * The live change-check. Returns two timestamps: when anything last changed in
 * the team (only if the caller is a member) and when the caller's notifications
 * last changed. Tabs compare them and re-fetch only when one moves.
 */
export async function GET(req: Request) {
  const guard = await guardRead(req, "pulse");
  if ("error" in guard) return guard.error;

  const slug = slugSchema.safeParse(new URL(req.url).searchParams.get("team") ?? "");
  let team: number | null = null;
  if (slug.success) {
    const t = await db.team.findFirst({
      where: { slug: slug.data, members: { some: { userId: guard.viewer.id } } },
      select: { activityAt: true },
    });
    team = t ? t.activityAt.getTime() : null;
  }
  return json({ team, inbox: guard.viewer.inboxAt.getTime() }, 200, guard.headers);
}
