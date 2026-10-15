/**
 * Site-wide staff roles from the command line. This is the only way to create
 * the first admin, and the way to recover if staff lock each other out.
 *
 *   npm run site:role -- list                       # who has a staff role
 *   npm run site:role -- <username> <ROLE>          # USER | SUPPORT | MODERATOR | ADMIN
 *   npm run site:role -- unsuspend <username>       # lift a suspension
 *
 *   npm run site:role -- yosuf ADMIN
 *
 * Why this is safe to keep in the repo:
 * - It needs the database connection string, so only operators can run it.
 *   There is no HTTP route, env flag or secret phrase that grants roles.
 * - It prints the database host it is about to change and asks you to type
 *   the username back before writing (pass --yes only in trusted automation).
 * - It never removes the last admin, never promotes suspended or deleted
 *   accounts, and records every change in the audit log as `cli.*`.
 *
 * Point it at production by exporting the production POSTGRES_* URLs (and
 * CLERK_SECRET_KEY for `unsuspend`) in your shell before running it.
 */
import { createInterface } from "node:readline/promises";
import { resolveDatabaseUrls } from "../lib/database-url.mjs";
import { createPrisma } from "../lib/prisma";
import { isSiteRole, SITE_ROLES, type SiteRole } from "../lib/site-roles";

const db = createPrisma();
const args = process.argv.slice(2).filter((a) => a !== "--yes");
const assumeYes = process.argv.includes("--yes");
const USAGE = `Usage:
  npm run site:role -- list
  npm run site:role -- <username> <${SITE_ROLES.join("|")}>
  npm run site:role -- unsuspend <username>
Add --yes to skip the confirmation prompt.`;

function dbHost() {
  try {
    return new URL(resolveDatabaseUrls().pooled ?? "").host || "unknown host";
  } catch {
    return "unknown host";
  }
}

async function confirm(username: string, what: string) {
  console.log(`\n  Database: ${dbHost()}\n  Change:   ${what}\n`);
  if (assumeYes) return;
  if (!process.stdin.isTTY) throw new Error("Not an interactive terminal. Re-run with --yes if you really mean it.");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`  Type the username (${username}) to confirm: `)).trim().replace(/^@/, "");
  rl.close();
  if (answer !== username) throw new Error("Confirmation didn't match. Nothing was changed.");
}

async function findUser(raw: string | undefined) {
  const username = raw?.replace(/^@/, "").toLowerCase();
  if (!username || !/^[a-z0-9_]{3,20}$/.test(username)) throw new Error(USAGE);
  const user = await db.user.findUnique({
    where: { username },
    select: { id: true, clerkId: true, username: true, email: true, siteRole: true, bannedAt: true, deletedAt: true },
  });
  if (!user || user.deletedAt) throw new Error(`No account @${username}. Sign up and choose that username first.`);
  return { ...user, username };
}

async function list() {
  const staff = await db.user.findMany({
    where: { siteRole: { not: "USER" }, deletedAt: null },
    orderBy: [{ siteRole: "desc" }, { username: "asc" }],
    select: { username: true, siteRole: true, bannedAt: true },
  });
  console.log(`Staff on ${dbHost()}:`);
  if (!staff.length) console.log("  (none yet)");
  for (const s of staff) console.log(`  ${s.siteRole.padEnd(10)} @${s.username}${s.bannedAt ? "  (suspended)" : ""}`);
}

async function setRole(rawUser: string | undefined, rawRole: string | undefined) {
  const role = rawRole?.toUpperCase();
  if (!isSiteRole(role)) throw new Error(USAGE);
  const user = await findUser(rawUser);
  if (user.siteRole === role) return console.log(`@${user.username} is already ${role}.`);
  if (role !== "USER" && user.bannedAt) throw new Error(`@${user.username} is suspended. Unsuspend them first.`);
  if (user.siteRole === "ADMIN" && role !== "ADMIN") {
    const admins = await db.user.count({ where: { siteRole: "ADMIN", deletedAt: null, bannedAt: null } });
    if (admins <= 1) throw new Error("That is the last admin. Make someone else ADMIN first.");
  }
  await confirm(user.username, `@${user.username} (${maskEmail(user.email)}): ${user.siteRole} → ${role}`);
  await db.user.update({ where: { id: user.id }, data: { siteRole: role as SiteRole } });
  await db.auditLog.create({
    data: { userId: user.id, action: `cli.site.role.${role}`, entityType: "User", entityId: user.id, ipAddress: "cli" },
  });
  console.log(`✔ @${user.username} is now ${role}.`);
}

async function unsuspend(rawUser: string | undefined) {
  const user = await findUser(rawUser);
  if (!user.bannedAt) return console.log(`@${user.username} isn't suspended.`);
  await confirm(user.username, `lift the suspension on @${user.username}`);
  await db.user.update({ where: { id: user.id }, data: { bannedAt: null, banReason: null } });
  await db.auditLog.create({
    data: { userId: user.id, action: "cli.user.unsuspended", entityType: "User", entityId: user.id, ipAddress: "cli" },
  });
  if (user.clerkId.startsWith("user_") && process.env.CLERK_SECRET_KEY) {
    const { createClerkClient } = await import("@clerk/backend");
    await createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY }).users.unbanUser(user.clerkId);
    console.log("✔ Unbanned in Clerk too.");
  } else if (user.clerkId.startsWith("user_")) {
    console.log("! CLERK_SECRET_KEY isn't set: unban them in the Clerk dashboard as well.");
  }
  console.log(`✔ @${user.username} can sign in again.`);
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  return `${name!.slice(0, 2)}***@${domain}`;
}

async function main() {
  const [first, second] = args;
  if (first === "list") return list();
  if (first === "unsuspend") return unsuspend(second);
  return setRole(first, second);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
