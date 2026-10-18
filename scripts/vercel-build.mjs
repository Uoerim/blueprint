// Vercel build: generate the client, apply migrations, build Next.
// Normalises the database env vars first so schema.prisma always finds
// POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING, whatever the host named them.
import { execSync } from "node:child_process";
import { resolveDatabaseUrls } from "../lib/database-url.mjs";
import { parseEncryptionKey } from "../lib/encryption-key.mjs";

const { pooled, direct } = resolveDatabaseUrls();
const target = process.env.VERCEL_ENV ?? "local";
const env = { ...process.env };
if (pooled) env.POSTGRES_PRISMA_URL = pooled;
if (direct) env.POSTGRES_URL_NON_POOLING = direct;

const run = (cmd) => execSync(cmd, { stdio: "inherit", env });

// Only production deploys from Vercel (vercel.json turns off branch and pull
// request previews). If a preview is ever built anyway, it must not touch the
// production database or need production secrets: it skips migrations below,
// and the key check applies to production only.
const production = target === "production";

// Idea and task text is encrypted at rest; a deployment without the key would
// refuse to start, so fail the build early with instructions instead.
if (process.env.VERCEL && production && !parseEncryptionKey(process.env.ENCRYPTION_KEY)) {
  console.error(`
✖ ENCRYPTION_KEY is ${process.env.ENCRYPTION_KEY ? "invalid" : "missing"} for this ${target} build.
  Generate one (keep it secret, and never change it once data is written):
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  Add it in Vercel → Project → Settings → Environment Variables
  (Production only), then redeploy.
`);
  process.exit(1);
}

run("prisma generate");

if (pooled && direct && production) {
  run("prisma migrate deploy");
} else if (production) {
  console.error(`
✖ No database connection string found for this Production build.
  Add these in Vercel → Project → Settings → Environment Variables (Production),
  or connect Neon under Storage, then redeploy:
    POSTGRES_PRISMA_URL       pooled URL (host contains -pooler)
    POSTGRES_URL_NON_POOLING  direct URL
  (DATABASE_URL / DATABASE_URL_UNPOOLED are accepted too.)
`);
  process.exit(1);
} else {
  console.warn(`⚠ ${target} build: migrations are only applied by production deploys, so they're skipped here.`);
}

run("next build");
