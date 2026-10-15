import "server-only";
import { NextResponse } from "next/server";
import { getViewer } from "./auth";
import { rateLimitHeaders, rateLimitRequest, type Tier } from "./rate-limit";
import { getClientIp } from "./request";

const NO_STORE = { "Cache-Control": "no-store" };

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

/**
 * Guard for read-only route handlers: same-site fetches only, signed in,
 * rate limited per IP and per user. Returns either a viewer or a ready
 * error response.
 */
export async function guardRead(req: Request, tier: Tier) {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") {
    return { error: json({ error: "Forbidden" }, 403) } as const;
  }
  const ip = getClientIp(req.headers);
  const viewer = await getViewer();
  if (!viewer) return { error: json({ error: "Unauthorized" }, 401) } as const;
  const rl = await rateLimitRequest(tier, ip, viewer.id);
  const headers = rateLimitHeaders(rl);
  if (!rl.success) return { error: json({ error: "Too many requests" }, 429, headers) } as const;
  return { viewer, headers } as const;
}
