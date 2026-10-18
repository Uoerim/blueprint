import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Search engines may index the public pages only; the app, its API, sign-in and
// the admin panel stay out of results (those pages also say noindex themselves).
export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/privacy", "/terms"],
        disallow: ["/dashboard", "/admin", "/api/", "/connect", "/onboarding", "/sign-in", "/sign-up", "/suspended", "/splash/"],
      },
    ],
    sitemap: new URL("/sitemap.xml", base).toString(),
    host: base.origin,
  };
}
