import { db } from "@/lib/db";
import { logServerError } from "@/lib/errors";
import { cleanClientName, newSecret, oauthError, oauthJson, redirectKind } from "@/lib/oauth";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";

/**
 * Dynamic client registration (RFC 7591), which Claude uses to set itself up.
 * Only Claude's own return addresses (or loopback, for Claude on this
 * computer) are accepted, so no other website can start the sign-in flow.
 * Clients are public (no secret); PKCE protects the code exchange. Apps that
 * nobody connected within a day are cleared out as new ones arrive, and a
 * site-wide cap on fresh, unused registrations stops a flood spread over many
 * addresses from filling the table.
 */

const MAX_FRESH_PER_HOUR = 1000;

export async function POST(req: Request) {
  const ip = getClientIp(req.headers);
  const rl = await rateLimit("oauthRegister", `ip:${ip}`, 200);
  if (!rl.success) return oauthError("too_many_requests", "Too many registrations. Try again later.", 429);

  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > 8_000) return oauthError("invalid_client_metadata", "Registration is too large.");
    body = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
  } catch {
    return oauthError("invalid_client_metadata", "Send the registration as a JSON object.");
  }

  const uris = body.redirect_uris;
  if (!Array.isArray(uris) || uris.length < 1 || uris.length > 5 || !uris.every((u) => typeof u === "string")) {
    return oauthError("invalid_redirect_uri", "Give one to five redirect_uris.");
  }
  if (!uris.every((u) => redirectKind(u))) {
    return oauthError("invalid_redirect_uri", "Only Claude can connect to Blueprint.");
  }
  const grantTypes = body.grant_types;
  if (grantTypes !== undefined && (!Array.isArray(grantTypes) || !grantTypes.includes("authorization_code"))) {
    return oauthError("invalid_client_metadata", "The authorization_code grant is required.");
  }

  try {
    const fresh = await db.oAuthClient.count({ where: { createdAt: { gt: new Date(Date.now() - 3_600_000) }, grants: { none: {} } } });
    if (fresh >= MAX_FRESH_PER_HOUR) return oauthError("temporarily_unavailable", "Too many new connections right now. Try again later.", 503);
    // Housekeeping: apps registered over a day ago that nobody ever connected.
    await db.oAuthClient.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86_400_000) }, grants: { none: {} } } });
    const client = await db.oAuthClient.create({
      data: { id: newSecret("bpc").slice(0, 36), name: cleanClientName(body.client_name), redirectUris: uris as string[] },
      select: { id: true, name: true, redirectUris: true, createdAt: true },
    });
    return oauthJson(
      {
        client_id: client.id,
        client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
        client_name: client.name,
        redirect_uris: client.redirectUris,
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      },
      201,
    );
  } catch (e) {
    logServerError("oauth-register", e);
    return oauthError("server_error", "Registration failed. Try again.", 500);
  }
}
