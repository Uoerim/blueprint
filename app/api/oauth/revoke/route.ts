import { db } from "@/lib/db";
import { logServerError } from "@/lib/errors";
import { oauthError, sha256 } from "@/lib/oauth";
import { revokeGrant } from "@/lib/oauth-tokens";
import { rateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";

/**
 * Token revocation (RFC 7009). When Claude disconnects, revoking either of its
 * tokens ends the whole connection (the stricter reading). Always answers 200,
 * so it can't be used to test whether a token exists.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req.headers);
  const rl = await rateLimit("oauth", `ip:${ip}`, 300);
  if (!rl.success) return oauthError("too_many_requests", "Too many requests. Try again shortly.", 429);
  try {
    const text = await req.text();
    if (text.length <= 4_000) {
      const form = new URLSearchParams(text);
      const value = form.get("token");
      const clientId = form.get("client_id");
      if (value && clientId) {
        const token = await db.oAuthToken.findUnique({
          where: { hash: sha256(value) },
          select: { grantId: true, grant: { select: { clientId: true, user: { select: { id: true, username: true } } } } },
        });
        if (token && token.grant.clientId === clientId) await revokeGrant(token.grantId, token.grant.user, ip, "agent.disconnected");
      }
    }
  } catch (e) {
    logServerError("oauth-revoke", e);
  }
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}
