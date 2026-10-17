import "server-only";
import { randomUUID } from "node:crypto";
import type { User } from "@prisma/client";
import { writeAudit } from "./audit";
import { isLockedOut } from "./auth";
import { db } from "./db";
import { ACCESS_TTL_S, isScope, newSecret, REFRESH_TTL_MS, sha256, type Scope } from "./oauth";

/** Issues a fresh access + refresh token pair for a connection. Returns the plain values once; only hashes are kept. */
export async function issueTokens(grantId: string, family: string = randomUUID()) {
  const access = newSecret("bpat");
  const refresh = newSecret("bprt");
  const now = Date.now();
  await db.$transaction([
    // Old, expired tokens of this connection go as new ones are made.
    db.oAuthToken.deleteMany({ where: { grantId, expiresAt: { lt: new Date(now) } } }),
    db.oAuthToken.createMany({
      data: [
        { hash: sha256(access), kind: "ACCESS", grantId, family, expiresAt: new Date(now + ACCESS_TTL_S * 1000) },
        { hash: sha256(refresh), kind: "REFRESH", grantId, family, expiresAt: new Date(now + REFRESH_TTL_MS) },
      ],
    }),
  ]);
  return { access, refresh };
}

export type AgentGrantInfo = { id: string; clientId: string; scopes: ReadonlySet<Scope>; teamIds: readonly string[] };
export type AgentAuth = { user: User; grant: AgentGrantInfo };

/**
 * Checks a bearer token from Claude: it must be a live access token of a
 * connection whose person is still active and onboarded. Returns null for
 * anything else (missing, unknown, expired, revoked, suspended, deleted).
 * One indexed lookup; "last used" is written at most every 5 minutes.
 */
export async function authenticateAgent(req: Request): Promise<AgentAuth | null> {
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(bpat_[A-Za-z0-9_-]{43})$/.exec(header.trim());
  if (!m) return null;
  const token = await db.oAuthToken.findUnique({
    where: { hash: sha256(m[1]!) },
    select: {
      kind: true,
      expiresAt: true,
      grant: { select: { id: true, clientId: true, scopes: true, teamIds: true, lastUsedAt: true, user: true } },
    },
  });
  if (!token || token.kind !== "ACCESS" || token.expiresAt.getTime() <= Date.now()) return null;
  const { grant } = token;
  const user = grant.user;
  if (isLockedOut(user) || !user.onboarded || !user.username) return null;
  if (!grant.lastUsedAt || Date.now() - grant.lastUsedAt.getTime() > 5 * 60_000) {
    await db.agentGrant.updateMany({ where: { id: grant.id }, data: { lastUsedAt: new Date() } });
  }
  return {
    user,
    grant: { id: grant.id, clientId: grant.clientId, scopes: new Set(grant.scopes.filter(isScope)), teamIds: grant.teamIds },
  };
}

/** Ends a connection: the app loses access at once (codes and tokens are deleted with it). */
export async function revokeGrant(grantId: string, actor: Pick<User, "id" | "username">, ip: string, reason: "agent.disconnected" | "security.agent_token_reuse") {
  const { count } = await db.agentGrant.deleteMany({ where: { id: grantId } });
  if (count) await writeAudit(actor, ip, { action: reason, entityType: "AgentGrant", entityId: grantId });
  return count > 0;
}
