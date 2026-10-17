import { db } from "@/lib/db";
import { logServerError } from "@/lib/errors";
import { ACCESS_TTL_S, oauthError, oauthJson, originOf, pkceMatches, redirectRegistered, resourceOk, sha256 } from "@/lib/oauth";
import { issueTokens, revokeGrant } from "@/lib/oauth-tokens";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";

/**
 * Token endpoint (OAuth 2.1, public clients):
 * - authorization_code: the one-time code (60s) + the PKCE verifier + the same
 *   redirect_uri and client_id it was issued for;
 * - refresh_token: each refresh token works once and is replaced. Presenting a
 *   spent one means it was copied, so the whole connection is ended.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req.headers);
  const rl = await rateLimit("oauth", `ip:${ip}`, 300);
  if (!rl.success) return oauthError("too_many_requests", "Too many requests. Try again shortly.", 429);

  let form: URLSearchParams;
  try {
    const type = req.headers.get("content-type") ?? "";
    const text = await req.text();
    if (text.length > 4_000) return oauthError("invalid_request", "Request too large.");
    form = type.includes("application/json") ? new URLSearchParams(JSON.parse(text)) : new URLSearchParams(text);
  } catch {
    return oauthError("invalid_request", "Send the request as a form.");
  }
  const get = (k: string) => form.get(k) ?? undefined;
  const clientId = get("client_id");
  if (!clientId) return oauthError("invalid_client", "client_id is required.", 401);

  try {
    if (get("grant_type") === "authorization_code") {
      const code = get("code");
      const verifier = get("code_verifier");
      const redirectUri = get("redirect_uri");
      if (!code || !verifier || !redirectUri) return oauthError("invalid_request", "code, code_verifier and redirect_uri are required.");
      if (!resourceOk(get("resource"), originOf(req))) return oauthError("invalid_target", "Tokens are only issued for this server's MCP endpoint.");
      // Taken out of the table in the same step it's read, so a code can only ever be used once.
      const rows = await db.oAuthCode.findMany({
        where: { hash: sha256(code) },
        select: { hash: true, grantId: true, redirectUri: true, codeChallenge: true, expiresAt: true, grant: { select: { clientId: true, scopes: true, client: { select: { redirectUris: true } } } } },
      });
      const row = rows[0];
      const { count } = await db.oAuthCode.deleteMany({ where: { hash: sha256(code) } });
      if (!row || count !== 1 || row.expiresAt.getTime() <= Date.now()) return oauthError("invalid_grant", "That code has expired or was already used.");
      if (row.grant.clientId !== clientId) return oauthError("invalid_grant", "That code belongs to a different app.");
      if (row.redirectUri !== redirectUri || !redirectRegistered(redirectUri, row.grant.client.redirectUris)) {
        return oauthError("invalid_grant", "redirect_uri doesn't match.");
      }
      if (!pkceMatches(verifier, row.codeChallenge)) return oauthError("invalid_grant", "PKCE verification failed.");
      const { access, refresh } = await issueTokens(row.grantId);
      return oauthJson({ access_token: access, token_type: "Bearer", expires_in: ACCESS_TTL_S, refresh_token: refresh, scope: row.grant.scopes.join(" ") });
    }

    if (get("grant_type") === "refresh_token") {
      const refresh = get("refresh_token");
      if (!refresh) return oauthError("invalid_request", "refresh_token is required.");
      const token = await db.oAuthToken.findUnique({
        where: { hash: sha256(refresh) },
        select: { kind: true, family: true, expiresAt: true, usedAt: true, grantId: true, grant: { select: { clientId: true, scopes: true, user: { select: { id: true, username: true } } } } },
      });
      if (!token || token.kind !== "REFRESH" || token.grant.clientId !== clientId) return oauthError("invalid_grant", "Unknown refresh token.");
      if (token.usedAt) {
        // A spent refresh token came back: someone copied it. End the connection for everyone holding it.
        await revokeGrant(token.grantId, token.grant.user, ip, "security.agent_token_reuse");
        return oauthError("invalid_grant", "This connection was ended for safety. Connect Claude again.");
      }
      if (token.expiresAt.getTime() <= Date.now()) return oauthError("invalid_grant", "The refresh token expired. Connect Claude again.");
      const { count } = await db.oAuthToken.updateMany({ where: { hash: sha256(refresh), usedAt: null }, data: { usedAt: new Date() } });
      if (count !== 1) return oauthError("invalid_grant", "That refresh token was just used.");
      const pair = await issueTokens(token.grantId, token.family);
      return oauthJson({ access_token: pair.access, token_type: "Bearer", expires_in: ACCESS_TTL_S, refresh_token: pair.refresh, scope: token.grant.scopes.join(" ") });
    }

    return oauthError("unsupported_grant_type", "Use authorization_code or refresh_token.");
  } catch (e) {
    logServerError("oauth-token", e);
    return oauthError("server_error", "Something went wrong. Try again.", 500);
  }
}
