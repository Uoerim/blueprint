import { guardRead, json, withErrors } from "@/lib/api";
import { db } from "@/lib/db";
import { id, searchQuerySchema } from "@/lib/validations";

/**
 * Prefix search on @username for inviting people. Signed-in callers only,
 * rate limited, at most 8 results, and only public profile fields: no emails,
 * no Clerk ids. With `teamId` (a team the caller belongs to) each result says
 * whether they're already a member or invited; without it (creating a new team)
 * every result is simply invitable.
 */
export const GET = withErrors(async (req: Request): Promise<Response> => {
  const guard = await guardRead(req, "invite");
  if (guard.error) return guard.error;

  const params = new URL(req.url).searchParams;
  const q = searchQuerySchema.safeParse(params.get("q") ?? "");
  if (!q.success) return json({ users: [] }, 200, guard.headers);

  const rawTeam = params.get("teamId");
  const teamId = rawTeam ? id.safeParse(rawTeam) : null;
  if (teamId && !teamId.success) return json({ users: [] }, 200, guard.headers);
  if (teamId?.success) {
    const membership = await db.teamMember.findUnique({
      where: { teamId_userId: { teamId: teamId.data, userId: guard.viewer.id } },
      select: { id: true },
    });
    if (!membership) return json({ error: "Not found" }, 404, guard.headers);
  }
  const team = teamId?.success ? teamId.data : null;

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
      imageUrl: true,
      ...(team && {
        memberships: { where: { teamId: team }, select: { id: true } },
        invitesRecv: { where: { teamId: team, status: "PENDING" as const }, select: { id: true } },
      }),
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
        imageUrl: u.imageUrl,
        state: "memberships" in u && (u.memberships as unknown[]).length
          ? "member"
          : "invitesRecv" in u && (u.invitesRecv as unknown[]).length
            ? "invited"
            : "none",
      })),
    },
    200,
    guard.headers,
  );
});
