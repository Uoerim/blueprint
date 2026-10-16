import "server-only";
import type { User } from "@prisma/client";
import { NextResponse } from "next/server";
import { getViewer, isLockedOut } from "./auth";
import { GENERIC_ERROR, logServerError } from "./errors";
import { rateLimitHeaders, rateLimitRequest, type Tier } from "./rate-limit";
import { getClientIp } from "./request";
import { logRateLimited } from "./security-log";

const NO_STORE = { "Cache-Control": "no-store" };

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

/**
 * Wraps a route handler so an unexpected error becomes a plain 500 with a
 * reference code, never a stack trace or a database message.
 */
export function withErrors(handler: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (e) {
      const ref = logServerError("api", e);
      return json({ error: GENERIC_ERROR, ref }, 500);
    }
  };
}

/**
 * Guard for read-only route handlers: same-site fetches only, signed in,
 * rate limited per IP and per user. Returns either a viewer or a ready
 * error response.
 */
type Guard =
  | { error: NextResponse; viewer?: never; headers?: never }
  | { error?: never; viewer: User; headers: Record<string, string> };

export async function guardRead(req: Request, tier: Tier): Promise<Guard> {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") {
    return { error: json({ error: "Forbidden" }, 403) };
  }
  const ip = getClientIp(req.headers);
  const viewer = await getViewer();
  if (!viewer) return { error: json({ error: "Unauthorized" }, 401) };
  if (isLockedOut(viewer)) return { error: json({ error: "Forbidden" }, 403) };
  const rl = await rateLimitRequest(tier, ip, viewer.id);
  const headers = rateLimitHeaders(rl);
  if (!rl.success) {
    await logRateLimited(viewer, ip, tier);
    return { error: json({ error: "Too many requests" }, 429, headers) };
  }
  return { viewer, headers };
}
