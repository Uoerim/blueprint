/**
 * Encrypts idea and task text that was written before ENCRYPTION_KEY was set
 * (or by older versions). Safe to re-run: rows already starting with
 * `enc:v1:` are skipped, and nothing is ever decrypted or rewritten twice.
 *
 *   npm run db:encrypt              # dry run: counts what would change
 *   npm run db:encrypt -- --apply   # encrypt in place
 *
 * Uses the same ENCRYPTION_KEY as the app. Point it at production by exporting
 * the production POSTGRES_* URLs and ENCRYPTION_KEY in your shell first.
 */
import { encryptionEnabled, encryptOptional, isEncrypted } from "../lib/crypto";
import { createPrisma } from "../lib/prisma";

const db = createPrisma();
const apply = process.argv.includes("--apply");
const BATCH = 200;

const plain = (v: string | null) => v !== null && v !== "" && !isEncrypted(v);

async function ideas() {
  let changed = 0;
  let cursor: string | undefined;
  for (;;) {
    const rows = await db.idea.findMany({
      select: { id: true, teamId: true, title: true, description: true, notes: true },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
    });
    if (!rows.length) break;
    for (const r of rows) {
      if (!plain(r.title) && !plain(r.description) && !plain(r.notes)) continue;
      changed++;
      if (!apply) continue;
      await db.idea.update({
        where: { id: r.id },
        data: {
          title: plain(r.title) ? encryptOptional(r.title, r.teamId) : r.title,
          description: plain(r.description) ? encryptOptional(r.description, r.teamId) : r.description,
          notes: plain(r.notes) ? encryptOptional(r.notes, r.teamId) : r.notes,
        },
      });
    }
    cursor = rows[rows.length - 1]!.id;
  }
  return changed;
}

async function tasks() {
  let changed = 0;
  let cursor: string | undefined;
  for (;;) {
    const rows = await db.task.findMany({
      select: { id: true, teamId: true, title: true, notes: true },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
    });
    if (!rows.length) break;
    for (const r of rows) {
      if (!plain(r.title) && !plain(r.notes)) continue;
      changed++;
      if (!apply) continue;
      await db.task.update({
        where: { id: r.id },
        data: {
          title: plain(r.title) ? encryptOptional(r.title, r.teamId) : r.title,
          notes: plain(r.notes) ? encryptOptional(r.notes, r.teamId) : r.notes,
        },
      });
    }
    cursor = rows[rows.length - 1]!.id;
  }
  return changed;
}

async function main() {
  if (!encryptionEnabled()) {
    throw new Error("ENCRYPTION_KEY is not set, so there is nothing to encrypt with. Add it to .env.local first.");
  }
  const [i, t] = [await ideas(), await tasks()];
  console.log(`${apply ? "Encrypted" : "Would encrypt"} ${i} idea(s) and ${t} task(s).`);
  if (!apply && i + t > 0) console.log("Run again with --apply to write the changes.");
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
