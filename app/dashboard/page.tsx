import { readable } from "@/components/ui/primitives";
import { withOnboardedPage } from "@/lib/auth";
import { db } from "@/lib/db";
import { firstName } from "@/lib/names";
import { DemoInvite } from "./_components/demo-invite";
import { NoInvites, NoTeams } from "./_components/home-empty";
import { WelcomeTour } from "./_components/welcome-tour";
import { InviteList } from "./_components/invites-bell";
import { NewTeamButton } from "./_components/new-team-button";
import { TeamHome, type HomeTeam } from "./_components/team-home";

export const metadata = { title: "Dashboard" };

/** The dashboard home: every team you're in, searchable and starrable, plus pending invites. */
export default async function DashboardHome() {
  // Your account and your teams in one wait; every query is scoped to the verified session.
  const [user, [memberships, mine, invites]] = await withOnboardedPage((clerkId) => Promise.all([
    db.teamMember.findMany({
      where: { user: { clerkId } },
      select: {
        role: true,
        favorite: true,
        customRole: { select: { name: true, color: true } },
        team: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            activityAt: true,
            _count: { select: { members: true } },
          },
        },
      },
    }),
    // Counts only: how many open tasks are assigned to you in each team.
    db.taskAssignee.groupBy({
      by: ["teamId"],
      where: { user: { clerkId }, task: { status: { not: "DONE" } } },
      _count: { _all: true },
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
  ]));

  const open = new Map(mine.map((m) => [m.teamId, m._count._all]));
  const teams: HomeTeam[] = memberships.map((m) => ({
    id: m.team.id,
    name: m.team.name,
    slug: m.team.slug,
    description: m.team.description,
    role: m.role,
    customRole: m.role === "MEMBER" ? m.customRole : null,
    favorite: m.favorite,
    members: m.team._count.members,
    openForMe: open.get(m.team.id) ?? 0,
    activityAt: m.team.activityAt.toISOString(),
  }));

  // A brand-new account has no teams yet: show what's empty instead of a blank page.
  const fresh = teams.length === 0;

  return (
    <div className="relative">
      <div aria-hidden className="bg-architect pointer-events-none absolute inset-0 h-[50vh] [mask-image:radial-gradient(60%_80%_at_30%_0%,black,transparent)]" />
      <div className="relative mx-auto w-full max-w-[1100px] px-4 pb-24 pt-10 sm:px-6 sm:pt-14 app:pb-6 app:pt-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          {/* The installed app already greets you in its header. */}
          <div className="app:hidden">
            <h1 className="text-[clamp(1.75rem,4.5vw,2.75rem)] font-semibold leading-[1.05] tracking-[-0.04em]">
              {fresh && !invites.length ? "Welcome" : "Welcome back"},{" "}
              <span style={{ color: readable(user.accentColor) }}>{firstName(user)}</span>
            </h1>
            <p className="mt-2 text-[15px] text-ink-2">
              {!fresh
                ? "Pick a team to jump in, or start a new one."
                : invites.length
                  ? "Accept an invite below, or start a team of your own."
                  : "Start a team of your own, or ask a friend to invite you."}
            </p>
          </div>
          <NewTeamButton />
        </div>

        {/* The welcome tour's sample invite, when there's no Invites section to point at. */}
        {invites.length === 0 && !fresh && <DemoInvite />}
        {/* Invites: always shown to someone without a team, so "nothing yet" is explicit. */}
        {(invites.length > 0 || fresh) && (
          <section aria-labelledby="invites-h" data-tour="invites" className="mt-8">
            <h2 id="invites-h" className="text-sm font-medium text-ink-2">
              Invites <span className="font-mono text-[11px] text-ink-3">{invites.length}</span>
            </h2>
            {invites.length === 0 ? (
              <NoInvites username={user.username!} />
            ) : (
              <div className="card mt-2 rounded-2xl p-2">
                <InviteList
                  invites={invites.map((i) => ({
                    id: i.id,
                    createdAt: i.createdAt.toISOString(),
                    team: i.team,
                    inviter: { username: i.inviter.username ?? "someone", accentColor: i.inviter.accentColor, imageUrl: i.inviter.imageUrl },
                  }))}
                />
              </div>
            )}
          </section>
        )}

        {fresh ? (
          <section aria-labelledby="teams-h" className="mt-8">
            <h2 id="teams-h" className="text-sm font-medium text-ink-2">
              Your teams <span className="font-mono text-[11px] text-ink-3">0</span>
            </h2>
            <NoTeams />
          </section>
        ) : (
          <TeamHome teams={teams} />
        )}
      </div>
      <WelcomeTour name={firstName(user)} username={user.username!} show={!user.toursDone.includes("welcome")} />
    </div>
  );
}
