import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { rateLimitHeaders, rateLimitRequest } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request";

// Coarse gate only: pages redirect to sign-in here, and every page, action and
// /api handler still runs its own resource-level check (lib/auth.ts, lib/api.ts).
const PROTECTED_PAGES = /^\/(dashboard|onboarding|admin)(\/|$)/;

export default clerkMiddleware(
  async (auth, req) => {
    // Tier 1: global sliding window per IP, before any auth work. The live
    // change-check (/api/pulse) has its own per-user tier instead, so a few open
    // tabs can't starve the rest of the app.
    const ip = getClientIp(req.headers);
    const rl = await rateLimitRequest(req.nextUrl.pathname === "/api/pulse" ? "pulse" : "global", ip);
    if (!rl.success) {
      return new NextResponse("Too Many Requests", {
        status: 429,
        headers: { ...rateLimitHeaders(rl), "Content-Type": "text/plain" },
      });
    }

    if (PROTECTED_PAGES.test(req.nextUrl.pathname)) await auth.protect();

    const res = NextResponse.next();
    for (const [k, v] of Object.entries(rateLimitHeaders(rl))) res.headers.set(k, v);
    return res;
  },
  {
    // Nonce-based CSP generated per request (Clerk's strict mode adds
    // 'strict-dynamic' + a fresh nonce; Next applies it to its own scripts).
    contentSecurityPolicy: {
      strict: true,
      directives: {
        "object-src": ["none"],
        "base-uri": ["self"],
        "frame-ancestors": ["none"],
        "font-src": ["self"],
        "img-src": ["self", "data:", "https://img.clerk.com"],
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
