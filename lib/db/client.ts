import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * SQLite allows one writer at a time. The background agent runner, chat polling and approvals
 * all write, so queries are serialised through one connection (with a generous wait) instead of
 * failing with "database is locked".
 */
function sqliteUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url || !url.startsWith("file:")) return url;
  const params: string[] = [];
  if (!/[?&]connection_limit=/.test(url)) params.push("connection_limit=1");
  if (!/[?&]socket_timeout=/.test(url)) params.push("socket_timeout=30");
  if (!params.length) return url;
  return url + (url.includes("?") ? "&" : "?") + params.join("&");
}

function create() {
  const url = sqliteUrl();
  const client = url ? new PrismaClient({ datasources: { db: { url } } }) : new PrismaClient();
  // WAL lets readers (chat polling) proceed while the runner writes.
  void client.$queryRawUnsafe("PRAGMA journal_mode = WAL;").catch(() => {});
  return client;
}

export const prisma = globalForPrisma.prisma ?? create();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
