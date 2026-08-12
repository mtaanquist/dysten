import { PrismaClient } from "@prisma/client";

/**
 * A single PrismaClient per process. Next's dev server re-evaluates modules on
 * every hot reload, so without stashing the instance on globalThis you end up
 * with a new connection pool per edit until SQLite starts refusing them.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
