import "server-only";
import { headers } from "next/headers";
import { db } from "./db";
import { isCodeChallenge, redirectKind, redirectRegistered, resourceOk } from "./oauth";

/** This site's origin for the current request (pages and server actions have no Request object). */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0]!.trim();
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? (local ? "http" : "https");
  return `${proto}://${host}`;
}

export type AuthorizeParams = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
  scope?: string;
  resource?: string;
};

export type CheckedRequest =
  | { ok: true; client: { id: string; name: string }; kind: "claude" | "local"; params: AuthorizeParams }
  /** Safe to send back to the app (its client and return address checked out). */
  | { ok: false; redirect: true; error: string; description: string; params: AuthorizeParams }
  /** Never redirect: the app or its return address can't be trusted. */
  | { ok: false; redirect: false; description: string };

const str = (v: unknown, max: number) => (typeof v === "string" && v.length <= max ? v : undefined);

/**
 * Validates an authorization request. The app (client_id) and its return
 * address (redirect_uri) are checked first: if either is wrong, nothing is
 * ever sent back to that address. Used by the consent page and again by the
 * approve/deny actions, so nothing from the browser is trusted.
 */
export async function checkAuthorizeRequest(raw: Record<string, unknown>, origin: string): Promise<CheckedRequest> {
  const clientId = str(raw.client_id, 64);
  const redirectUri = str(raw.redirect_uri, 300);
  if (!clientId || !redirectUri) return { ok: false, redirect: false, description: "This connection link is incomplete. Start again from Claude." };
  const client = await db.oAuthClient.findUnique({ where: { id: clientId }, select: { id: true, name: true, redirectUris: true } });
  const kind = redirectKind(redirectUri);
  if (!client || !kind || !redirectRegistered(redirectUri, client.redirectUris)) {
    return { ok: false, redirect: false, description: "This connection link isn't valid. Start again from Claude." };
  }
  const params: AuthorizeParams = {
    clientId,
    redirectUri,
    codeChallenge: str(raw.code_challenge, 128) ?? "",
    state: str(raw.state, 500),
    scope: str(raw.scope, 200),
    resource: str(raw.resource, 300),
  };
  if (raw.response_type !== "code") return { ok: false, redirect: true, error: "unsupported_response_type", description: "Only the code flow is supported.", params };
  if (raw.code_challenge_method !== "S256" || !isCodeChallenge(params.codeChallenge)) {
    return { ok: false, redirect: true, error: "invalid_request", description: "PKCE with S256 is required.", params };
  }
  if (!resourceOk(params.resource, origin)) return { ok: false, redirect: true, error: "invalid_target", description: "Unknown resource.", params };
  return { ok: true, client: { id: client.id, name: client.name }, kind, params };
}
