import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/*
 * Connect Claude: Blueprint is its own OAuth 2.1 authorization server for the
 * MCP endpoint (/api/mcp). The person signs in with their normal Blueprint
 * account, picks teams and permissions on the consent screen (/connect), and
 * Claude gets short-lived tokens that can only ever do what that person can
 * do, in the teams they picked, while each team's owner allows it.
 *
 * - Public clients only, PKCE S256 required, authorization codes last 60s and
 *   work once.
 * - Access tokens last 1 hour; refresh tokens 30 days and work once (rotated).
 *   Reusing a spent refresh token is treated as theft and ends the connection.
 * - Only SHA-256 hashes of codes and tokens are stored, never the values.
 * - Apps register themselves (RFC 7591, which Claude needs), but only Claude's
 *   own return addresses, or a loopback address for Claude on this computer,
 *   are accepted, so other websites can't use the flow.
 */

export const SCOPES = {
  read: "See ideas, projects and tasks you can see in the teams you pick",
  tasks: "Work on tasks: edit them, move them between columns, add and tick subtasks",
  create: "Add new ideas and tasks",
} as const;
export type Scope = keyof typeof SCOPES;
export const ALL_SCOPES = Object.keys(SCOPES) as Scope[];
export const isScope = (s: string): s is Scope => s in SCOPES;

export const CODE_TTL_MS = 60_000;
export const ACCESS_TTL_S = 60 * 60;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60_000;

/** Parses a space-separated scope string; unknown scopes are ignored, "read" is always included. */
export function parseScopes(raw: string | null | undefined): Scope[] {
  const asked = (raw ?? "").split(/\s+/).filter(isScope);
  const set = new Set<Scope>(asked.length ? asked : ALL_SCOPES);
  set.add("read");
  return ALL_SCOPES.filter((s) => set.has(s));
}

/** A new random secret with a readable prefix ("bpat_…" access, "bprt_…" refresh, "bpac_…" code). */
export function newSecret(prefix: "bpat" | "bprt" | "bpac" | "bpc"): string {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** PKCE S256: base64url(sha256(verifier)) must equal the challenge, compared in constant time. */
export function pkceMatches(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  const computed = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  const expected = Buffer.from(challenge);
  return computed.length === expected.length && timingSafeEqual(computed, expected);
}

export const isCodeChallenge = (v: string) => /^[A-Za-z0-9\-_]{43,128}$/.test(v);

const CLAUDE_CALLBACKS = new Set(["https://claude.ai/api/mcp/auth_callback", "https://claude.com/api/mcp/auth_callback"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Who a return address belongs to, or null when it isn't one we accept. */
export function redirectKind(uri: string): "claude" | "local" | null {
  if (uri.length > 300) return null;
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return null;
  }
  if (u.username || u.password || u.hash) return null;
  if (CLAUDE_CALLBACKS.has(`${u.origin}${u.pathname}`) && !u.search) return "claude";
  // Claude Code and Claude Desktop finish sign-in on a loopback address (RFC 8252).
  if (u.protocol === "http:" && LOOPBACK_HOSTS.has(u.hostname)) return "local";
  return null;
}

/**
 * Whether a redirect_uri in a request matches one the app registered: exactly,
 * except that loopback addresses may use any port (RFC 8252 §7.3).
 */
export function redirectRegistered(uri: string, registered: readonly string[]): boolean {
  if (!redirectKind(uri)) return false;
  if (registered.includes(uri)) return true;
  const u = new URL(uri);
  if (u.protocol !== "http:" || !LOOPBACK_HOSTS.has(u.hostname)) return false;
  return registered.some((r) => {
    try {
      const v = new URL(r);
      return v.protocol === "http:" && v.hostname === u.hostname && v.pathname === u.pathname && v.search === u.search;
    } catch {
      return false;
    }
  });
}

/** Builds the redirect back to the app with the given parameters. */
export function redirectWith(uri: string, params: Record<string, string | undefined>): string {
  const u = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, v);
  return u.toString();
}

/** Where this server lives, from the request (each domain is self-consistent). */
export const originOf = (req: Request) => new URL(req.url).origin;
export const mcpUrl = (origin: string) => `${origin}/api/mcp`;

/** The resource the token is for must be this server's MCP endpoint (RFC 8707), when given. */
export function resourceOk(resource: string | null | undefined, origin: string): boolean {
  if (!resource) return true;
  return resource.replace(/\/+$/, "") === mcpUrl(origin);
}

/** A short, safe display name for an app (it names itself, so it's untrusted). */
export function cleanClientName(name: unknown): string {
  const s = typeof name === "string" ? name : "";
  const cleaned = s.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩<>]/g, "").replace(/\s+/g, " ").trim();
  return cleaned.slice(0, 60) || "Unnamed app";
}

/** JSON response that's never cached (OAuth responses carry tokens). */
export function oauthJson(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", Pragma: "no-cache", ...extra },
  });
}

export const oauthError = (error: string, description: string, status = 400) =>
  oauthJson({ error, error_description: description }, status);
