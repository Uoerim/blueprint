import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { KofiButton } from "@/components/kofi-button";
import { PageMemory, SupportButton } from "@/components/support";
import { BrandMark } from "@/components/ui/primitives";
import { withOnboardedPage } from "@/lib/auth";
import { db } from "@/lib/db";
import { firstName } from "@/lib/names";
import { isStaff } from "@/lib/site-roles";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import type { IncomingInvite, TeamSummary } from "@/lib/types";
import { AccountMenu } from "./_components/account-menu";
import { AppHeader, AppPreviewSwitch, BottomNav, DashboardProvider, type Me } from "./_components/app-shell";
import { InstallPrompt } from "./_components/install-prompt";
import { InvitesBell } from "./_components/invites-bell";
import { LivePulse } from "./_components/live-pulse";
import { TeamSwitcher } from "./_components/team-switcher";
import { UsernameChip } from "./_components/username-chip";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  // Your account, teams and invites in one wait; every query is scoped to the verified session.
  const [user, [memberships, invites]] = await withOnboardedPage((clerkId) => Promise.all([
    db.teamMember.findMany({
      where: { user: { clerkId } },
      select: { role: true, favorite: true, team: { select: { id: true, name: true, slug: true } } },
      orderBy: [{ favorite: "desc" }, { joinedAt: "asc" }],
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

  const jar = await cookies();
  const theme = parseTheme(jar.get(THEME_COOKIE)?.value);
  // Ideas/Tasks tabs in the installed app open the team you were last in (only if you're still a member).
  // The cookie is untrusted input: a malformed value is ignored, and only a team you belong to is used.
  let remembered = "";
  try {
    remembered = decodeURIComponent(jar.get("bp-last-team")?.value ?? "");
  } catch {}
  const lastTeam = memberships.some((m) => m.team.slug === remembered) ? remembered : (memberships[0]?.team.slug ?? null);
  const teams: TeamSummary[] = memberships.map((m) => ({ ...m.team, role: m.role, favorite: m.favorite }));
  const incoming: IncomingInvite[] = invites.map((i) => ({
    id: i.id,
    createdAt: i.createdAt.toISOString(),
    team: i.team,
    inviter: { username: i.inviter.username ?? "someone", accentColor: i.inviter.accentColor, imageUrl: i.inviter.imageUrl },
  }));

  const me: Me = {
    username: user.username!,
    displayName: user.displayName,
    accentColor: user.accentColor,
    imageUrl: user.imageUrl,
    theme,
    staff: isStaff(user.siteRole),
  };

  return (
    <DashboardProvider teams={teams} me={me}>
      <div className="flex min-h-screen flex-col">
        <header className="glass sticky top-0 z-40 border-b border-line app:hidden">
          <div className="flex h-14 items-center gap-1.5 px-2 sm:gap-3 sm:px-5">
            <Link href="/dashboard" aria-label="Dashboard home, all teams" className="grid size-8 place-items-center rounded-md text-ink transition-colors hover:bg-tint/[0.06]">
              <BrandMark size={20} />
            </Link>
            <span className="hidden text-ink-3 sm:inline" aria-hidden>/</span>
            <div data-tour="nav" className="flex min-w-0">
              <TeamSwitcher teams={teams} />
            </div>
            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-3">
              {isStaff(user.siteRole) && (
                <Link
                  href="/admin"
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber/12 px-2.5 text-[13px] font-medium text-amber transition-colors hover:bg-amber/20"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M8 1.5 2.75 3.5v4c0 3.2 2.2 5.9 5.25 7 3.05-1.1 5.25-3.8 5.25-7v-4L8 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  </svg>
                  <span className="hidden sm:inline">Admin</span>
                </Link>
              )}
              <KofiButton label="Ko-fi" className="hidden h-8 px-2.5 md:inline-flex" />
              {/* On phones support lives in the profile menu, so the bar stays uncluttered. */}
              <div data-tour="help" className="hidden sm:block">
                <SupportButton />
              </div>
              <InvitesBell invites={incoming} />
              <UsernameChip username={user.username!} color={user.accentColor} imageUrl={user.imageUrl} />
              <div data-tour="help" className="flex">
                <AccountMenu theme={theme} />
              </div>
            </div>
          </div>
        </header>
        <AppHeader name={firstName(user)} username={user.username!} accentColor={user.accentColor} imageUrl={user.imageUrl} invites={incoming} />
        {/* In the installed app, leave room under the content for the floating tab bar. */}
        <div className="flex-1 app:pb-[calc(6rem+env(safe-area-inset-bottom))]">{children}</div>
        <Suspense>
          <BottomNav lastTeam={lastTeam} />
          <AppPreviewSwitch />
        </Suspense>
        <LivePulse />
        <PageMemory />
        <InstallPrompt />
      </div>
    </DashboardProvider>
  );
}
