import { guardRead, json } from "@/lib/api";
import { db } from "@/lib/db";
import { id, searchQuerySchema } from "@/lib/validations";

/**
 * Prefix search on @username. Only onboarded users, at most 8 results, and
 * only public profile fields — no emails, no Clerk ids. Requires a team the
 * caller belongs to, so the directory can't be scraped anonymously.
 */
export async function GET(req: Request) {
  const guard = await guardRead(req, "search");
  if ("error" in guard) return guard.error;

  const params = new URL(req.url).searchParams;
  const q = searchQuerySchema.safeParse(params.get("q") ?? "");
  const teamId = id.safeParse(params.get("teamId") ?? "");
  if (!q.success || !teamId.success) return json({ users: [] }, 200, guard.headers);

  const membership = await db.teamMember.findUnique({
    where: { teamId_userId: { teamId: teamId.data, userId: guard.viewer.id } },
    select: { id: true },
  });
  if (!membership) return json({ error: "Not found" }, 404, guard.headers);

  const users = await db.user.findMany({
    where: {
      onboarded: true,
      bannedAt: null,
      deletedAt: null,
      username: { startsWith: q.data, mode: "insensitive" },
      id: { not: guard.viewer.id },
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      accentColor: true,
      memberships: { where: { teamId: teamId.data }, select: { id: true } },
      invitesRecv: { where: { teamId: teamId.data, status: "PENDING" }, select: { id: true } },
    },
    orderBy: { username: "asc" },
    take: 8,
  });

  return json(
    {
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        accentColor: u.accentColor,
        state: u.memberships.length ? "member" : u.invitesRecv.length ? "invited" : "none",
      })),
    },
    200,
    guard.headers,
  );
}
