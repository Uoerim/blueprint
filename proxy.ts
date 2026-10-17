import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { rateLimitHeaders, rateLimitRequest } from "@/lib/rate-limit";
import { anonymizeIp, automationReason, getClientIp, mutationBlockReason } from "@/lib/request";

// Coarse gate only: pages redirect to sign-in here, and every page, action and
// /api handler still runs its own resource-level check (lib/auth.ts, lib/api.ts).
const PROTECTED_PAGES = /^\/(dashboard|onboarding|admin|connect)(\/|$)/;
// Where only real browsers belong: the app itself, its API and the sign-in screens.
// Public pages (landing, privacy, terms) stay open to search engines and link previews.
const PRIVATE_ROUTES = /^\/(dashboard|onboarding|admin|api|sign-in|sign-up|suspended|connect)(\/|$)/;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// Connect Claude: called by Claude (not a browser) with a bearer token, never a
// cookie, so there's nothing to forge cross-site; each route authenticates the
// token and is rate limited per connection. Bot screening and origin checks
// don't apply, and the per-IP ceiling is the generous "agent" one.
const AGENT_ROUTES = /^\/(api\/mcp|api\/oauth\/(token|register|revoke)|\.well-known\/oauth-(protected-resource|authorization-server))(\/|$)/;

function refuse(status: 403 | 429, reason: string, ip: string, path: string, headers?: Record<string, string>) {
  // Logged with a shortened IP only; never request bodies or cookies.
  console.warn(`[edge] ${status} ${reason} ip=${anonymizeIp(ip)} path=${path}`);
  return new NextResponse(status === 429 ? "Too Many Requests" : "Forbidden", {
    status,
    headers: { ...headers, "Content-Type": "text/plain", "Cache-Control": "no-store" },
  });
}

export default clerkMiddleware(
  async (auth, req) => {
    // Tier 1: global sliding window per IP, before any auth work. The live
    // change-check (/api/pulse) has its own per-user tier instead, so a few open
    // tabs can't starve the rest of the app.
    const ip = getClientIp(req.headers);
    const path = req.nextUrl.pathname;
    const mutation = !SAFE_METHODS.has(req.method);

    if (AGENT_ROUTES.test(path)) {
      const rl = await rateLimitRequest("agent", ip);
      if (!rl.success) return refuse(429, "rate limited", ip, path, rateLimitHeaders(rl));
      return NextResponse.next();
    }

    // Tier 0: obvious bots and scripts never reach the app's private routes or any mutation.
    if (mutation || PRIVATE_ROUTES.test(path)) {
      const bot = automationReason(req.headers, mutation);
      if (bot) return refuse(403, bot, ip, path);
    }
    // Every mutation (server actions included) must come from this site's own pages.
    if (mutation) {
      const forged = mutationBlockReason(req.headers);
      if (forged) return refuse(403, forged, ip, path);
    }

    const rl = await rateLimitRequest(path === "/api/pulse" ? "pulse" : "global", ip);
    if (!rl.success) return refuse(429, "rate limited", ip, path, rateLimitHeaders(rl));

    if (PROTECTED_PAGES.test(req.nextUrl.pathname)) await auth.protect();

    const res = NextResponse.next();
    for (const [k, v] of Object.entries(rateLimitHeaders(rl))) res.headers.set(k, v);
    return res;
  },
  {
    // Signed-out visitors always land on Blueprint's own sign-in page, never on
    // Clerk's hosted Account Portal, whatever the environment variables say.
    signInUrl: "/sign-in",
    signUpUrl: "/sign-up",
    // Nonce-based CSP generated per request (Clerk's strict mode adds
    // 'strict-dynamic' + a fresh nonce; Next applies it to its own scripts).
    contentSecurityPolicy: {
      strict: true,
      directives: {
        "object-src": ["none"],
        "base-uri": ["self"],
        "frame-ancestors": ["none"],
        "default-src": ["self"],
        "font-src": ["self", "data:"],
        "img-src": ["self", "data:", "https://img.clerk.com", "https://images.clerk.dev"],
        "form-action": ["self"],
        // Ko-fi donation embed (components/kofi-button.tsx).
        "frame-src": ["https://ko-fi.com"],
        ...(process.env.NODE_ENV === "production" && { "upgrade-insecure-requests": [] }),
      },
    },
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
