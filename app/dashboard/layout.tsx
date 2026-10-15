import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import type { ReactNode } from "react";
import { KofiButton } from "@/components/kofi-button";
import { BrandMark, Monogram, readable } from "@/components/ui/primitives";
import { requireOnboardedPage } from "@/lib/auth";
import { db } from "@/lib/db";
import type { IncomingInvite, TeamSummary } from "@/lib/types";
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
            <KofiButton label="Ko-fi" className="hidden h-8 px-2.5 md:inline-flex" />
            <InvitesBell invites={incoming} />
            <Link
              href="/dashboard/settings"
              aria-label="Settings"
              title="Settings"
              className="grid size-9 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-tint/[0.06] hover:text-ink"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path d="M10 12.75a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5Z" stroke="currentColor" strokeWidth="1.5" />
                <path d="M16.2 12.2a1.3 1.3 0 0 0 .26 1.43l.05.05a1.58 1.58 0 1 1-2.23 2.23l-.05-.05a1.3 1.3 0 0 0-1.43-.26 1.3 1.3 0 0 0-.79 1.19v.14a1.58 1.58 0 0 1-3.16 0v-.07a1.3 1.3 0 0 0-.85-1.19 1.3 1.3 0 0 0-1.43.26l-.05.05a1.58 1.58 0 1 1-2.23-2.23l.05-.05a1.3 1.3 0 0 0 .26-1.43 1.3 1.3 0 0 0-1.19-.79h-.14a1.58 1.58 0 0 1 0-3.16h.07a1.3 1.3 0 0 0 1.19-.85 1.3 1.3 0 0 0-.26-1.43l-.05-.05a1.58 1.58 0 1 1 2.23-2.23l.05.05a1.3 1.3 0 0 0 1.43.26h.06a1.3 1.3 0 0 0 .79-1.19v-.14a1.58 1.58 0 0 1 3.16 0v.07a1.3 1.3 0 0 0 .79 1.19 1.3 1.3 0 0 0 1.43-.26l.05-.05a1.58 1.58 0 1 1 2.23 2.23l-.05.05a1.3 1.3 0 0 0-.26 1.43v.06a1.3 1.3 0 0 0 1.19.79h.14a1.58 1.58 0 0 1 0 3.16h-.07a1.3 1.3 0 0 0-1.19.79Z" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </Link>
            <span className="hidden items-center gap-2 rounded-lg py-1 pl-1 pr-2.5 sm:flex" style={{ backgroundColor: `${user.accentColor}12` }}>
              <Monogram name={user.username!} color={user.accentColor} size={22} />
              <span className="font-mono text-xs" style={{ color: readable(user.accentColor) }}>@{user.username}</span>
            </span>
            <UserButton />
          </div>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
