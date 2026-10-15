import { cookies } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { KofiButton } from "@/components/kofi-button";
import { SupportButton } from "@/components/support";
import { BrandMark, Monogram, readable } from "@/components/ui/primitives";
import { requireOnboardedPage } from "@/lib/auth";
import { db } from "@/lib/db";
import { isStaff } from "@/lib/site-roles";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import type { IncomingInvite, TeamSummary } from "@/lib/types";
import { AccountMenu } from "./_components/account-menu";
import { InvitesBell } from "./_components/invites-bell";
import { TeamSwitcher } from "./_components/team-switcher";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await requireOnboardedPage();

  const [memberships, invites] = await Promise.all([
    db.teamMember.findMany({
      where: { userId: user.id },
      select: { role: true, team: { select: { id: true, name: true, slug: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    db.teamInvite.findMany({
      where: { inviteeId: user.id, status: "PENDING" },
      select: {
        id: true,
        createdAt: true,
        team: { select: { name: true, slug: true } },
        inviter: { select: { username: true, accentColor: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const teams: TeamSummary[] = memberships.map((m) => ({ ...m.team, role: m.role }));
  const incoming: IncomingInvite[] = invites.map((i) => ({
    id: i.id,
    createdAt: i.createdAt.toISOString(),
    team: i.team,
    inviter: { username: i.inviter.username ?? "someone", accentColor: i.inviter.accentColor },
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="glass sticky top-0 z-40 border-b border-line">
        <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
          <Link href="/" aria-label="Blueprint home" className="grid size-8 place-items-center rounded-md text-ink transition-colors hover:bg-tint/[0.06]">
            <BrandMark size={20} />
          </Link>
          <span className="text-ink-3" aria-hidden>/</span>
          <TeamSwitcher teams={teams} />
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
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
            <SupportButton />
            <InvitesBell invites={incoming} />
            <span className="hidden items-center gap-2 rounded-lg py-1 pl-1 pr-2.5 sm:flex" style={{ backgroundColor: `${user.accentColor}12` }}>
              <Monogram name={user.username!} color={user.accentColor} size={22} />
              <span className="font-mono text-xs" style={{ color: readable(user.accentColor) }}>@{user.username}</span>
            </span>
            <AccountMenu theme={theme} />
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
