import { computeStats, getRunDetail, ServiceError } from "@/lib/services/run-service";
import type { Stats } from "@/lib/client";

export type Loaded<T> = { ok: true; data: T } | { ok: false; error: string };

/** Server pages use this so a missing/unmigrated database shows guidance instead of crashing. */
export async function safeLoad<T>(fn: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof ServiceError) return { ok: false, error: err.message };
    console.error("[IntentGuard page]", err);
    return { ok: false, error: "IntentGuard could not read its SQLite database." };
  }
}

export async function loadStats(): Promise<Stats> {
  return computeStats();
}

export async function loadRunOrNull(runId: string | undefined | null) {
  if (!runId) return null;
  try {
    return await getRunDetail(runId);
  } catch (err) {
    if (err instanceof ServiceError && err.status === 404) return null;
    throw err;
  }
}
