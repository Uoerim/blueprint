# Blueprint

**Where raw ideas become shipped reality.** A fast, private idea vault and execution board for friends and small squads.

[![Next.js](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Clerk](https://img.shields.io/badge/Auth-Clerk-6C47FF?logo=clerk&logoColor=white)](https://clerk.com)
[![Neon](https://img.shields.io/badge/DB-Neon%20Serverless%20Postgres-00E599?logo=postgresql&logoColor=white)](https://neon.tech)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748?logo=prisma)](https://prisma.io)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Framer Motion](https://img.shields.io/badge/Framer%20Motion-14-0055FF?logo=framer&logoColor=white)](https://motion.dev)
[![Zod](https://img.shields.io/badge/Validation-Zod%204-3E67B1?logo=zod&logoColor=white)](https://zod.dev)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-Non--Commercial%20(CC%20BY--NC--SA%204.0)-lightgrey)](./LICENSE)

---

## The philosophy

Enterprise project managers were built for org charts. Four friends with a side project need none of it: no sprints, no story points, no seat licences, no workflow editor. Every minute spent configuring a tool is a minute the idea goes cold.

What a squad actually needs is three things:

1. **A place to throw ideas the moment they land.** ⌘K, type, hashtag, done. Under three seconds.
2. **A way to agree which ones are worth doing.** Sparks are cheap co-signs, so the vault sorts itself without a meeting.
3. **A quiet signal that someone is on it.** Press *Start working* and your name glows in the Live Focus dock.

When something ships, it stays on the record, with your `@handle` on it.

## Features

| | |
| --- | --- |
| **Zero-photo interactive landing page** | The hero is a working replica of the vault and focus dock, built in React + Framer Motion. Promote an idea, start focus, mark it done, right on the page. No stock photos, no screenshots. |
| **Unique `@username` onboarding** | After Clerk sign-up, everyone claims a unique handle (`^[a-z0-9_]{3,20}$`, reserved words blocked) with a live, debounced, rate-limited availability check and a signature accent colour. Enforced by a Postgres unique index. |
| **Multi-team workspaces** | Anyone can create teams (auto or custom slug), switch between them, and invite people by searching `@username` (⌘I). Invites land in a bell with one-click accept/decline. Roles: `OWNER`, `ADMIN`, `MEMBER`. |
| **Idea Vault** | Quick-capture bar with `#feature` `#bug` `#experiment` `#random` tags, author handle, timestamps, Spark/co-sign counter, sort by most-sparked or newest. |
| **Promote to execution** | A slide-over drawer breaks an idea into concrete tasks, each with an owner (custom popover, no native selects) and a priority. Tasks remember their parent idea. |
| **Execution board** | Kanban (`Backlog → Ready → In Progress → Done`) or compact list view, filters for All / My tasks / Unassigned / every `@member`, optimistic updates, SVG strikethrough on *Mark done*. |
| **Live Team Focus dock** | Pinned at the top of every team: who is working on what right now, glowing in their accent colour, with a running timer. Refreshes every 15 seconds while the tab is visible. |
| **Shipped archive** | HUD strip (Ideas in vault, Tasks remaining, Teammates in focus, Total shipped) and a day-by-day timeline of who shipped what, including fully executed ideas. |

## Security architecture

| Layer | What it does | Where |
| --- | --- | --- |
| **IP sliding-window rate limiting** | Global 100 req/60s per IP in the proxy; 30/60s for username checks and user search (anti-enumeration); 20/60s for writes; 10/60s for onboarding. Applied per IP *and* per user. Returns `429` with `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. In-memory LRU by default; set Upstash / Vercel KV REST credentials for a shared store. | `lib/rate-limit.ts`, `proxy.ts` |
| **Safe client IP extraction** | `x-vercel-forwarded-for` → `x-real-ip` → `x-forwarded-for`, validated. | `lib/request.ts` |
| **Zero-trust team isolation** | Every team-scoped action resolves the Clerk session to an onboarded Prisma user and re-proves `TeamMember` membership in Postgres. URL slugs and client ids are never trusted. Role checks for member removal and role changes. | `lib/auth.ts`, `app/actions/*` |
| **Anti-IDOR** | Every update/delete is scoped with `{ id, teamId: verifiedTeamId }`; assignees must be members of that exact team. | `app/actions/*` |
| **CSRF / origin checks** | Every Server Action verifies `Origin` matches `Host`; read endpoints reject cross-site `Sec-Fetch-Site`. | `lib/action.ts`, `lib/api.ts` |
| **Strict validation** | Zod `.strict()` schemas on every input; control/bidi characters and HTML stripped; length and tag limits; Prisma parameterised queries only. Server Action body limit 64 KB. | `lib/validations.ts` |
| **Hardened headers** | Per-request nonce CSP with `strict-dynamic`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`; HSTS preload; `X-Frame-Options: DENY`; `nosniff`; strict referrer and permissions policies; `X-Powered-By` removed. | `proxy.ts`, `next.config.ts` |
| **Safe errors** | Errors are logged server-side and mapped to generic messages; stack traces and Prisma codes never reach the client. | `lib/action.ts`, `app/error.tsx` |
| **Audit log** | Team creation, invites, membership changes, ideas, focus and completions are written to `AuditLog` with the caller's IP. | `lib/action.ts` |

## Quick start

**Requirements:** Node.js 20.9+ and a free [Neon](https://neon.tech) database.

```bash
git clone https://github.com/Uoerim/blueprint.git
cd blueprint
npm install
```

**1. Clerk.** Link the project to a Clerk application. This writes the keys to `.env.local`:

```bash
npx -y clerk@latest init
```

**2. Neon Serverless Postgres.** Copy `.env.example` to `.env.local` (or add to the file Clerk created) and paste your Neon connection strings:

```bash
POSTGRES_PRISMA_URL=...        # pooled
POSTGRES_URL_NON_POOLING=...   # direct
```

**3. Database.** Push the schema, and optionally seed two demo squads:

```bash
npm run db:deploy    # applies prisma/migrations (use db:push only for throwaway experiments)
npm run db:seed      # optional; SEED_INVITE_USERNAME=your_handle invites you to the demo teams
```

**4. Run it.**

```bash
npm run dev
```

Open http://localhost:3000, sign up, claim your `@handle`, create a team.

### Scripts

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate` + production build |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint |
| `npm run db:migrate` / `db:deploy` / `db:push` / `db:seed` / `db:studio` | Prisma against the URLs in `.env.local` (`db:migrate` creates a migration, `db:deploy` applies them) |
| `npm run team:role -- <username> <team-slug> <role>` (role: `OWNER`, `ADMIN` or `MEMBER`) | Grant a team role from the terminal (adds the user to the team if needed) |

### Notes

- Prisma runs in Rust-free mode (`engineType = "client"`) on the **Neon serverless driver adapter**, so there is no native query engine. It works on serverless/edge-style hosts and on Windows ARM64.
- Users are synced lazily: the first authenticated request creates the Prisma `User` from the Clerk session, so no webhook is required.
- `TaskStatus` includes `READY` on top of `TODO` / `IN_PROGRESS` / `DONE` so the board has four columns.

## Deploy to Vercel

The repo is production-ready for Vercel: `vercel.json` pins functions to `iad1` (next to Neon's `us-east-1`), and Vercel runs the `vercel-build` script automatically (`scripts/vercel-build.mjs`): `prisma generate`, then `prisma migrate deploy`, then `next build`. It accepts Neon variables under any of their names (`POSTGRES_PRISMA_URL`/`POSTGRES_URL_NON_POOLING`, `DATABASE_URL`/`DATABASE_URL_UNPOOLED`, or prefixed), derives the direct URL from a pooled Neon URL if needed, and fails a Production build with a clear message when no database is configured. So every deploy applies pending migrations before building. A brand-new database gets its tables on the first deploy.

### 1. Clerk production instance

1. In the [Clerk Dashboard](https://dashboard.clerk.com), open the app, switch the instance toggle from **Development** to **Production**, and create it (choose to clone the development settings).
2. Clerk production needs a **domain you own** (it can't use `*.vercel.app`). Enter it, then add the DNS records Clerk lists (CNAMEs such as `clerk.`, `accounts.`, `clkmail.` and the two DKIM records) at your DNS provider. Wait until **Domains** shows them verified.
3. **SSO connections → GitHub and Google** need your own OAuth credentials in production:
   - **GitHub:** github.com → Settings → Developer settings → OAuth Apps → New. Homepage URL is `https://your-domain`, and the callback URL is the **Authorized redirect URI** shown in Clerk's GitHub connection. Paste the Client ID and Secret into Clerk.
   - **Google:** Google Cloud Console → APIs & Services. Configure the OAuth consent screen and **publish** it. Then go to Credentials → Create OAuth client ID (Web application), with authorized origin `https://your-domain` and redirect URI from Clerk's Google connection. Paste the ID and Secret into Clerk.
4. **API keys** (production): copy `pk_live_…` and `sk_live_…`.

### 2. Vercel project

1. **Add New → Project → Import** this GitHub repo. Leave framework (Next.js), root directory, build and install commands on their defaults.
2. **Storage:** connect a database and, for shared rate limits, Redis. Both inject env vars automatically:
   - **Neon** (Marketplace): creates `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING` and others. Or paste the URLs of an existing Neon database yourself.
   - **Upstash for Redis** (Marketplace): creates `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Without it, each serverless instance rate-limits on its own.
3. **Environment variables** (Settings → Environment Variables):

   | Name | Production value |
   | --- | --- |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_…` |
   | `CLERK_SECRET_KEY` | `sk_live_…` |
   | `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
   | `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
   | `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/dashboard` |
   | `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/onboarding` |
   | `POSTGRES_PRISMA_URL` | Neon **pooled** URL (host contains `-pooler`) |
   | `POSTGRES_URL_NON_POOLING` | Neon **direct** URL (used by migrations at build time) |
   | `KV_REST_API_URL`, `KV_REST_API_TOKEN` | from Upstash (optional, recommended) |

   Scope the `pk_live`/`sk_live` keys and the production database to **Production** only. For **Preview**, use your development Clerk keys and a separate Neon branch. Otherwise a preview build would run migrations against production.
4. **Domains:** add the same domain you gave Clerk, and point DNS at Vercel as instructed.
5. **Deploy.** `NEXT_PUBLIC_*` values are baked in at build time, so redeploy after changing them.

### 3. After the first deploy

- Sign up on your domain, claim your `@handle` and create a team. You're its owner.
- Do **not** run `db:seed` against production (the script refuses unless `SEED_ALLOW_PRODUCTION=1`).
- To grant a role on production, run `team:role` with the production `POSTGRES_*` URLs in your environment.
- Schema changes later: `npm run db:migrate -- --name <change>` locally, commit `prisma/migrations`, push. Vercel applies them on deploy.

## License

**Blueprint is free and open source for non-commercial use**, under [Creative Commons Attribution-NonCommercial-ShareAlike 4.0](./LICENSE).

- ✅ Clone, modify, self-host and use it with your friends, co-founders, classes or teams, for free.
- ✅ Share your changes, under the same license, with credit.
- ❌ Do not sell it, offer it as a paid hosted SaaS, or bundle it into a commercial product without written permission from the author.

See [`LICENSE`](./LICENSE) for the summary and the full legal text.
