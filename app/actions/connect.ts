"use server";

import { z } from "zod";
import { audit, runAction } from "@/lib/action";
import { ActionError } from "@/lib/auth";
import { checkAuthorizeRequest, requestOrigin } from "@/lib/connect";
import { db } from "@/lib/db";
import { CODE_TTL_MS, isScope, newSecret, redirectWith, sha256, type Scope } from "@/lib/oauth";
import { revokeGrant } from "@/lib/oauth-tokens";
import { id } from "@/lib/validations";

/*
 * The consent screen's buttons. Everything the browser sends is checked again
 * here: the app and its return address, PKCE, the scopes, and every team
 * (you must be in it and its owner must allow Claude). Only then is a
 * one-time code made, and the browser is sent back to Claude with it.
 */

const consentSchema = z.strictObject({
  request: z.record(z.string(), z.string().max(500)),
  teamIds: z.array(id).min(1, "Pick at least one team.").max(50),
  scopes: z.array(z.string().max(20)).max(5),
});

export async function approveConnection(input: unknown) {
  return runAction({ tier: "auth" }, async (ctx) => {
    const { request, teamIds, scopes } = consentSchema.parse(input);
    const origin = await requestOrigin();
    const checked = await checkAuthorizeRequest(request, origin);
    if (!checked.ok) throw new ActionError(checked.description);

    const wanted = [...new Set(["read", ...scopes])].filter(isScope) as Scope[];
    const allowed = await db.teamMember.findMany({
      where: { userId: ctx.user.id, teamId: { in: teamIds }, team: { agentAccess: true } },
      select: { teamId: true },
    });
    if (allowed.length !== new Set(teamIds).size) throw new ActionError("One of those teams doesn't allow Claude any more. Refresh and try again.");

    const code = newSecret("bpac");
    const grant = await db.$transaction(async (tx) => {
      const g = await tx.agentGrant.upsert({
        where: { userId_clientId: { userId: ctx.user.id, clientId: checked.client.id } },
        create: { userId: ctx.user.id, clientId: checked.client.id, scopes: wanted, teamIds: [...new Set(teamIds)] },
        update: { scopes: wanted, teamIds: [...new Set(teamIds)], createdAt: new Date() },
        select: { id: true },
      });
      // Connecting again starts clean: earlier tokens and codes of this app stop working.
      await tx.oAuthToken.deleteMany({ where: { grantId: g.id } });
      await tx.oAuthCode.deleteMany({ where: { grantId: g.id } });
      await tx.oAuthCode.create({
        data: {
          hash: sha256(code),
          grantId: g.id,
          redirectUri: checked.params.redirectUri,
          codeChallenge: checked.params.codeChallenge,
          resource: checked.params.resource ?? null,
          expiresAt: new Date(Date.now() + CODE_TTL_MS),
        },
      });
      return g;
    });
    await audit(ctx, { action: "agent.connected", entityType: "AgentGrant", entityId: grant.id });
    // iss (RFC 9207) lets Claude confirm the code came from this server.
    return { redirectTo: redirectWith(checked.params.redirectUri, { code, state: checked.params.state, iss: origin }) };
  });
}

export async function denyConnection(input: unknown) {
  return runAction({ tier: "auth" }, async () => {
    const { request } = z.strictObject({ request: z.record(z.string(), z.string().max(500)) }).parse(input);
    const checked = await checkAuthorizeRequest(request, await requestOrigin());
    if (!checked.ok && !checked.redirect) throw new ActionError(checked.description);
    const params = checked.params;
    return { redirectTo: redirectWith(params.redirectUri, { error: "access_denied", error_description: "The person declined.", state: params.state }) };
  });
}

/** Disconnects one of your connected apps (the Connect Claude page). Only ever your own. */
export async function disconnectApp(input: unknown) {
  return runAction({ tier: "write" }, async (ctx) => {
    const { grantId } = z.strictObject({ grantId: id }).parse(input);
    const own = await db.agentGrant.findFirst({ where: { id: grantId, userId: ctx.user.id }, select: { id: true } });
    if (!own) throw new ActionError("That connection is already gone.");
    await revokeGrant(own.id, ctx.user, ctx.ip, "agent.disconnected");
    return null;
  });
}
