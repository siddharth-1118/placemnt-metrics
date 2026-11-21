import { PrismaClient } from "@prisma/client";

function getCleanDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;

  if (raw.startsWith("postgres://") || raw.startsWith("postgresql://")) {
    try {
      const url = new URL(raw);
      // Auto-switch Supabase pooler from session mode (5432, pool_size: 15) to transaction mode (6543)
      // to permanently eliminate FATAL: (EMAXCONNSESSION) max clients reached in session mode.
      if (url.hostname.includes("pooler.supabase.com")) {
        if (url.port === "5432") {
          url.port = "6543";
        }
        if (!url.searchParams.has("pgbouncer")) {
          url.searchParams.set("pgbouncer", "true");
        }
      }

      // Enforce connection_limit=1 on serverless so each lambda holds at most 1 connection.
      // This prevents bursting beyond Supabase's pool_size: 15 limit (EMAXCONNSESSION).
      if (!url.searchParams.has("connection_limit")) {
        url.searchParams.set("connection_limit", "1");
      }
      if (!url.searchParams.has("connect_timeout")) {
        url.searchParams.set("connect_timeout", "15");
      }
      if (!url.searchParams.has("pool_timeout")) {
        url.searchParams.set("pool_timeout", "20");
      }
      return url.toString();
    } catch {
      return raw;
    }
  }
  return raw;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const databaseUrl = getCleanDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

// Always store on globalThis so serverless lambdas reuse the single PrismaClient
// and connection pool across invocations instead of spawning fresh connections per request.
globalForPrisma.prisma = prisma;

