import { handleRpc, PROTOCOL_VERSIONS } from "@/lib/mcp/server";
import { mcpUrl, originOf } from "@/lib/oauth";
import { authenticateAgent } from "@/lib/oauth-tokens";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";

/**
 * Connect Claude: the MCP endpoint. Claude calls it with a bearer token from
 * Blueprint's own OAuth flow (lib/oauth.ts); anything else gets a 401 that
 * tells it where to sign in. Stateless (no sessions), JSON responses, 256 KB
 * request cap, rate limited per connection. Browsers from other sites are
 * refused outright (the Origin check MCP asks for).
 */

const MAX_BODY = 256 * 1024;

function unauthorized(req: Request, error?: "invalid_token") {
  const origin = originOf(req);
  const params = [`resource_metadata="${origin}/.well-known/oauth-protected-resource"`, ...(error ? [`error="${error}"`] : [])];
  return new Response(JSON.stringify({ error: error ?? "unauthorized", error_description: "Connect Claude to Blueprint to use this." }), {
    status: 401,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "WWW-Authenticate": `Bearer ${params.join(", ")}` },
  });
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== originOf(req)) return json({ error: "forbidden" }, 403);

  const version = req.headers.get("mcp-protocol-version");
  if (version && !PROTOCOL_VERSIONS.includes(version)) return json({ error: "unsupported_protocol_version" }, 400);

  const auth = await authenticateAgent(req);
  if (!auth) return unauthorized(req, req.headers.has("authorization") ? "invalid_token" : undefined);

  const rl = await rateLimit("agent", `grant:${auth.grant.id}`);
  if (!rl.success) return json({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Too many requests. Wait a moment." } }, 429, rateLimitHeaders(rl));

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BODY) return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Request too large" } }, 413);
  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Request too large" } }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }

  const reply = await handleRpc(body, { ...auth, ip: getClientIp(req.headers) });
  if (reply === null) return new Response(null, { status: 202 });
  return json(reply);
}

// Stateless server: no server-to-client stream and no sessions to end.
const notAllowed = (req: Request) =>
  new Response(null, { status: 405, headers: { Allow: "POST", Link: `<${mcpUrl(originOf(req))}>; rel="self"` } });
export const GET = notAllowed;
export const DELETE = notAllowed;
