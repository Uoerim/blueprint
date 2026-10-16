import "server-only";
import { createPrisma, type Db } from "./prisma";

const globalForPrisma = globalThis as unknown as { prisma?: Db };

export const db =
  globalForPrisma.prisma ??
  createPrisma(process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
