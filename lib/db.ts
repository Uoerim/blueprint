import "server-only";
import type { PrismaClient } from "@prisma/client";
import { createPrisma } from "./prisma";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  createPrisma(process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
