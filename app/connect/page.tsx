import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { btn, cx } from "@/components/ui/primitives";
import { requireOnboardedPage } from "@/lib/auth";
import { checkAuthorizeRequest, requestOrigin } from "@/lib/connect";
import { db } from "@/lib/db";
import { parseScopes, redirectWith } from "@/lib/oauth";
import { ConsentForm } from "./consent-form";

export const metadata: Metadata = { title: "Connect Claude", robots: { index: false, follow: false } };

/**
 * The OAuth consent screen (authorization endpoint) for Connect Claude. You're
 * signed in to Blueprint here (proxy.ts sends you to sign in first), then pick
 * which of your teams Claude may use and what it may do. Teams whose owner
 * hasn't allowed Claude can't be picked.
 */
export default async function ConnectPage({ searchParams }: PageProps<"/connect">) {
  const user = await requireOnboardedPage();
  const sp = await searchParams;
  const raw = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const checked = await checkAuthorizeRequest(raw, await requestOrigin());

  if (!checked.ok && checked.redirect) {
    redirect(redirectWith(checked.params.redirectUri, { error: checked.error, error_description: checked.description, state: checked.params.state }));
  }
  if (!checked.ok) {
    return (
      <AuthShell>
        <div className="card w-full max-w-md rounded-2xl p-6 sm:p-8">
          <h1 className="text-xl font-semibold tracking-tight">Can&apos;t connect</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{checked.description}</p>
          <Link href="/dashboard/connections" className={cx(btn.outline, "mt-6 w-full")}>How to connect Claude</Link>
        </div>
      </AuthShell>
    );
  }

  const [memberships, existing] = await Promise.all([
    db.teamMember.findMany({
      where: { userId: user.id },
      select: { role: true, team: { select: { id: true, name: true, slug: true, agentAccess: true } } },
      orderBy: [{ favorite: "desc" }, { joinedAt: "asc" }],
    }),
    db.agentGrant.findUnique({ where: { userId_clientId: { userId: user.id, clientId: checked.client.id } }, select: { teamIds: true, scopes: true } }),
  ]);

  const teams = memberships.map((m) => ({
    id: m.team.id,
    name: m.team.name,
    slug: m.team.slug,
    allowed: m.team.agentAccess,
    owner: m.role === "OWNER",
  }));
  // The request passed on to the approve/deny actions, which check it all again.
  const request = Object.fromEntries(
    Object.entries({
      response_type: "code",
      client_id: checked.params.clientId,
      redirect_uri: checked.params.redirectUri,
      code_challenge: checked.params.codeChallenge,
      code_challenge_method: "S256",
      state: checked.params.state,
      scope: checked.params.scope,
      resource: checked.params.resource,
    }).filter((e): e is [string, string] => typeof e[1] === "string"),
  );

  return (
    <AuthShell>
      <ConsentForm
        request={request}
        username={user.username!}
        kind={checked.kind}
        clientName={checked.client.name}
        returnHost={new URL(checked.params.redirectUri).host}
        teams={teams}
        initialTeams={existing?.teamIds ?? []}
        initialScopes={existing?.scopes ?? parseScopes(checked.params.scope)}
      />
    </AuthShell>
  );
}
