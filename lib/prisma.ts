import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrls } from "./database-url.mjs";

/** Prisma over Neon's serverless driver (pooled connection string). */
export function createPrisma(log: ("warn" | "error")[] = ["error"]) {
  const { pooled } = resolveDatabaseUrls();
  if (!pooled) throw new Error("No database URL: set POSTGRES_PRISMA_URL (or DATABASE_URL).");
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString: pooled }), log });
}
