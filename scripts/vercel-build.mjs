// Vercel build: generate the client, apply migrations, build Next.
// Normalises the database env vars first so schema.prisma always finds
// POSTGRES_PRISMA_URL / POSTGRES_URL_NON_POOLING, whatever the host named them.
import { execSync } from "node:child_process";
import { resolveDatabaseUrls } from "../lib/database-url.mjs";

const { pooled, direct } = resolveDatabaseUrls();
const target = process.env.VERCEL_ENV ?? "local";
const env = { ...process.env };
if (pooled) env.POSTGRES_PRISMA_URL = pooled;
if (direct) env.POSTGRES_URL_NON_POOLING = direct;

const run = (cmd) => execSync(cmd, { stdio: "inherit", env });

run("prisma generate");

if (pooled && direct) {
  run("prisma migrate deploy");
} else if (target === "production") {
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
  console.warn(`⚠ No database URL for this ${target} build: skipping migrations. Pages that read data will fail until one is set.`);
}

run("next build");
