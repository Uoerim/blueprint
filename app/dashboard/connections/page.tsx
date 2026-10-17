import type { Metadata } from "next";
import Link from "next/link";
import { requireOnboardedPage } from "@/lib/auth";
import { requestOrigin } from "@/lib/connect";
import { db } from "@/lib/db";
import { mcpUrl, SCOPES, isScope } from "@/lib/oauth";
import { ConnectionList, CopyField } from "./connections-ui";

export const metadata: Metadata = { title: "Connect Claude" };

/**
 * Connect Claude: how to add Blueprint to Claude, the apps you've connected
 * (with Disconnect), and which of your teams allow it. Only ever your own
 * connections; "connections" is a reserved slug, so no team can live here.
 */
export default async function ConnectionsPage() {
  const user = await requireOnboardedPage();
  const [grants, memberships] = await Promise.all([
    db.agentGrant.findMany({
      where: { userId: user.id },
      select: { id: true, scopes: true, teamIds: true, createdAt: true, lastUsedAt: true, client: { select: { name: true, redirectUris: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.teamMember.findMany({
      where: { userId: user.id },
      select: { role: true, team: { select: { id: true, name: true, slug: true, agentAccess: true } } },
      orderBy: [{ favorite: "desc" }, { joinedAt: "asc" }],
    }),
  ]);
  const teamById = new Map(memberships.map((m) => [m.team.id, m.team]));
  const url = mcpUrl(await requestOrigin());

  const connections = grants.map((g) => ({
    id: g.id,
    app: g.client.redirectUris.some((u) => u.startsWith("https://claude.")) ? "Claude" : "Claude on a computer",
    detail: g.client.name,
    scopes: g.scopes.filter(isScope).map((s) => SCOPES[s]),
    teams: g.teamIds.map((id) => teamById.get(id)).filter((t) => t?.agentAccess).map((t) => t!.name),
    createdAt: g.createdAt.toISOString(),
    lastUsedAt: g.lastUsedAt?.toISOString() ?? null,
  }));

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 pb-24 pt-8 sm:px-6 app:pt-2">
      <p className="text-[13px] font-medium text-accent">Connect Claude</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Let Claude work on your tasks</h1>
      <p className="mt-2 max-w-[64ch] text-[15px] leading-relaxed text-ink-2">
        Connect Claude and ask it to go through your tasks, plan them into subtasks, write descriptions and notes, tick things off and capture
        ideas. It works as you, with exactly your permissions, only in the teams you pick, and only where the team&apos;s owner allows it.
      </p>

      <section aria-labelledby="how-h" className="card mt-6 rounded-2xl p-5 sm:p-6">
        <h2 id="how-h" className="text-lg font-semibold tracking-tight">Add Blueprint to Claude</h2>
        <p className="mt-1 text-[14px] text-ink-2">Use this address as a custom connector:</p>
        <CopyField value={url} />
        <ol className="mt-5 grid gap-4 sm:grid-cols-2">
          <li className="rounded-xl bg-surface-2 p-4 shadow-highlight">
            <p className="text-[14px] font-medium text-ink">Claude on the web, desktop or phone</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
              Open <em>Settings → Connectors</em>, choose <em>Add custom connector</em>, name it Blueprint and paste the address. Press
              Connect, sign in to Blueprint, then pick your teams and what Claude may do.
            </p>
          </li>
          <li className="rounded-xl bg-surface-2 p-4 shadow-highlight">
            <p className="text-[14px] font-medium text-ink">Claude Code</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-2">Run this, then type /mcp in Claude Code to sign in:</p>
            <CopyField value={`claude mcp add --transport http blueprint ${url}`} small />
          </li>
        </ol>
        <p className="mt-4 text-[13px] text-ink-3">Then try: &ldquo;Go through my open Blueprint tasks and plan the first one into subtasks.&rdquo;</p>
      </section>

      <section aria-labelledby="conn-h" className="mt-8">
        <h2 id="conn-h" className="text-lg font-semibold tracking-tight">Your connections</h2>
        <ConnectionList connections={connections} />
      </section>

      <section aria-labelledby="teams-h" className="mt-8">
        <h2 id="teams-h" className="text-lg font-semibold tracking-tight">Your teams</h2>
        <p className="mt-1 text-[14px] text-ink-2">Claude can only use a team its owner has allowed, in the team&apos;s settings under Claude.</p>
        {memberships.length ? (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl bg-surface shadow-highlight">
            {memberships.map(({ team, role }) => (
              <li key={team.id} className="flex items-center gap-3 px-4 py-3">
                <span className={team.agentAccess ? "size-2 shrink-0 rounded-full bg-emerald" : "size-2 shrink-0 rounded-full bg-ink-3"} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-[14px] text-ink">{team.name}</span>
                <span className="shrink-0 text-[13px] text-ink-3">
                  {team.agentAccess ? "Allowed" : role === "OWNER" ? (
                    <Link href={`/dashboard/${team.slug}/settings#claude`} className="text-accent hover:underline">Allow in settings</Link>
                  ) : "Not allowed by the owner"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-2xl bg-surface px-4 py-3 text-[14px] text-ink-3 shadow-highlight">You&apos;re not in any team yet.</p>
        )}
      </section>

      <section aria-labelledby="safe-h" className="card mt-8 rounded-2xl p-5 sm:p-6">
        <h2 id="safe-h" className="text-lg font-semibold tracking-tight">How it stays safe</h2>
        <ul className="mt-3 grid gap-x-6 gap-y-2.5 text-[14px] leading-relaxed text-ink-2 sm:grid-cols-2">
          <li><strong className="text-ink">Never more than you.</strong> Every request is checked against your current role, the task&apos;s own rules and the team&apos;s switch, the same way the app checks you.</li>
          <li><strong className="text-ink">No destructive tools.</strong> Claude can&apos;t delete anything, manage members, roles or invites, or change any settings.</li>
          <li><strong className="text-ink">Short-lived keys.</strong> Claude holds a key that lasts an hour and renews itself; Blueprint stores only scrambled fingerprints of them. A copied renewal key ends the connection.</li>
          <li><strong className="text-ink">Yours to end.</strong> Disconnect here any time, and owners can switch a team off for everyone at once.</li>
          <li><strong className="text-ink">On the record.</strong> Changes show up as yours, marked &ldquo;via Claude&rdquo; in the security history.</li>
          <li><strong className="text-ink">Your data, your call.</strong> What Claude reads is sent to Anthropic to answer you, under its own terms. See our <Link href="/privacy" className="text-ink underline decoration-line-strong underline-offset-2">Privacy Policy</Link>.</li>
        </ul>
      </section>
    </div>
  );
}
