import { redirect } from "next/navigation";
import { requireOnboardedPage } from "@/lib/auth";
import { readable } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { InviteList } from "./_components/invites-bell";
import { NewTeamButton } from "./_components/new-team-button";

export const metadata = { title: "Dashboard" };

export default async function DashboardIndex() {
  const user = await requireOnboardedPage();
  const first = await db.teamMember.findFirst({
    where: { userId: user.id },
    orderBy: { joinedAt: "asc" },
    select: { team: { select: { slug: true } } },
  });
  if (first) redirect(`/dashboard/${first.team.slug}`);

  const invites = await db.teamInvite.findMany({
    where: { inviteeId: user.id, status: "PENDING" },
    select: {
      id: true,
      createdAt: true,
      team: { select: { name: true, slug: true } },
      inviter: { select: { username: true, accentColor: true, imageUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="relative">
      <div aria-hidden className="bg-architect pointer-events-none absolute inset-0 h-[60vh] [mask-image:radial-gradient(60%_80%_at_30%_0%,black,transparent)]" />
      <div className="relative mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h1 className="text-[clamp(2rem,5vw,3.25rem)] font-semibold leading-[1.02] tracking-[-0.04em]">
          Welcome, <span style={{ color: readable(user.accentColor) }}>@{user.username}</span>.
        </h1>
        <p className="mt-4 max-w-[48ch] text-[17px] leading-relaxed text-ink-2">
          Start a squad of your own, or accept an invite below. Teams are private: only members see the vault.
        </p>
        <div className="mt-8">
          <NewTeamButton />
        </div>

        <section className="mt-16">
          <h2 className="text-lg font-semibold tracking-tight">Pending invites</h2>
          <div className="card mt-4 rounded-2xl p-2">
            <InviteList
              invites={invites.map((i) => ({
                id: i.id,
                createdAt: i.createdAt.toISOString(),
                team: i.team,
                inviter: { username: i.inviter.username ?? "someone", accentColor: i.inviter.accentColor, imageUrl: i.inviter.imageUrl },
              }))}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
