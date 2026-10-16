import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { withOnboardedPage } from "@/lib/auth";
import { db } from "@/lib/db";
import type { IncomingInvite } from "@/lib/types";
import { NoTeamScreen } from "./no-team-screen";

export const metadata: Metadata = { title: "Start a team" };

/**
 * Where the installed app's Ideas and Tasks tabs lead before you're in any team:
 * explains what lives there and gets you into one (create a team, or accept an
 * invite). "new" is a reserved slug, so no team can ever live at this address.
 * Once you belong to a team, this page sends you straight to it.
 */
export default async function NoTeamPage({ searchParams }: PageProps<"/dashboard/new">) {
  const { for: tab } = await searchParams;
  const focus = tab === "tasks" ? "tasks" : "ideas";

  const [user, [membership, invites]] = await withOnboardedPage((clerkId) =>
    Promise.all([
      db.teamMember.findFirst({
        where: { user: { clerkId } },
        orderBy: [{ favorite: "desc" }, { joinedAt: "asc" }],
        select: { team: { select: { slug: true } } },
      }),
      db.teamInvite.findMany({
        where: { invitee: { clerkId }, status: "PENDING" },
        select: {
          id: true,
          createdAt: true,
          team: { select: { name: true, slug: true } },
          inviter: { select: { username: true, accentColor: true, imageUrl: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]),
  );

  if (membership) redirect(`/dashboard/${membership.team.slug}?view=${focus === "tasks" ? "board" : "vault"}`);

  const incoming: IncomingInvite[] = invites.map((i) => ({
    id: i.id,
    createdAt: i.createdAt.toISOString(),
    team: i.team,
    inviter: { username: i.inviter.username ?? "someone", accentColor: i.inviter.accentColor, imageUrl: i.inviter.imageUrl },
  }));

  return <NoTeamScreen focus={focus} username={user.username!} invites={incoming} />;
}
