import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

/** Prisma over Neon's serverless driver (pooled connection string). */
export function createPrisma(log: ("warn" | "error")[] = ["error"]) {
  const connectionString = process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error("POSTGRES_PRISMA_URL is not set");
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }), log });
}
