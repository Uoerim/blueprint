/*
 * The site's public identity, used for search results, link previews, the
 * sitemap and structured data. SITE_URL (optional, no secrets) pins the address
 * for self-hosted copies; on Vercel the production domain is used automatically.
 */

export const SITE = {
  name: "Blueprint - Idea Vault",
  shortName: "Blueprint",
  tagline: "Where raw ideas become shipped reality",
  description:
    "Blueprint is a free, private idea vault and task board for small teams. Capture ideas, spark the best ones, turn them into projects with tasks and subtasks, see who's working on what live, and keep a record of everything you ship. Encrypted per team.",
  keywords: [
    "idea vault",
    "idea management",
    "task board",
    "kanban",
    "team task manager",
    "project planning",
    "small teams",
    "encrypted",
    "Blueprint",
  ],
} as const;

export function siteUrl(): URL {
  const pinned = process.env.SITE_URL?.trim();
  if (pinned) return new URL(pinned);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL("http://localhost:3000");
}
