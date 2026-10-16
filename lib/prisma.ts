import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrls } from "./database-url.mjs";

/** Prisma over Neon's serverless driver (pooled connection string). */
export function createPrisma(log: ("warn" | "error")[] = ["error"]) {
  const { pooled } = resolveDatabaseUrls();
  if (!pooled) throw new Error("No database URL: set POSTGRES_PRISMA_URL (or DATABASE_URL).");
  // Honour ?schema= like Prisma's own engine does (used for isolated test schemas).
  const schema = new URL(pooled).searchParams.get("schema") ?? undefined;
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString: pooled }, { schema }), log }).$extends(appendOnlyAudit);
}

const refuse = () => {
  throw new Error("AuditLog is append-only.");
};

/**
 * The audit trail can be written and read, never changed: the client refuses
 * every update and delete on it. The database enforces the same with a trigger
 * (migration 6_audit_append_only), which also covers raw SQL.
 */
const appendOnlyAudit = {
  name: "append-only-audit",
  query: {
    auditLog: { update: refuse, updateMany: refuse, upsert: refuse, delete: refuse, deleteMany: refuse },
  },
} as const;

export type Db = ReturnType<typeof createPrisma>;
