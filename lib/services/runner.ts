import { prisma } from "@/lib/db/client";
import { ServiceError, stepRun } from "./run-service";
import { loadAlertForAction } from "./alerts";
import { sendAlert } from "./notify";

/**
 * Server-side driver for chat runs. The agent keeps working when the user leaves the page;
 * every step still goes through stepRun → IntentGuard, exactly as in the step API.
 * A run pauses by itself on WARN (waiting for approval) and stops on completion or halt.
 */

const g = globalThis as unknown as { __igDriving?: Set<string> };
const driving = (g.__igDriving ??= new Set<string>());

/** Small pause between non-model steps so progress is visible in the chat. */
const SCRIPTED_STEP_PAUSE_MS = 650;
const MAX_STEPS_PER_DRIVE = 20;

export function isDriving(runId: string) {
  return driving.has(runId);
}

const TRANSIENT = /database is locked|SQLITE_BUSY|P1008|P2034|Timed out|socket timeout|ECONNRESET/i;

export function driveRun(runId: string): void {
  if (driving.has(runId)) return;
  driving.add(runId);
  void (async () => {
    let transientRetries = 0;
    try {
      for (let i = 0; i < MAX_STEPS_PER_DRIVE; i++) {
        let res: Awaited<ReturnType<typeof stepRun>>;
        try {
          res = await stepRun(runId);
          transientRetries = 0;
        } catch (err) {
          // The run is paused for approval or already finished: nothing to drive, not an error.
          if (err instanceof ServiceError && err.status === 409) return;
          // A busy database or a dropped connection: wait and try the same step again.
          if (transientRetries < 3 && TRANSIENT.test(err instanceof Error ? err.message : String(err))) {
            transientRetries++;
            await new Promise((r) => setTimeout(r, 400 * transientRetries));
            i--;
            continue;
          }
          throw err;
        }
        if (res.outcome === "action") {
          const last = await prisma.action.findFirst({ where: { runId }, orderBy: { sequence: "desc" }, select: { id: true, decision: true } });
          if (last && (last.decision === "WARN" || last.decision === "BLOCK")) {
            const alert = await loadAlertForAction(last.id).catch(() => null);
            if (alert) void sendAlert(alert);
          }
        }
        if (res.run.status !== "RUNNING") break;
        if (res.run.mode !== "LIVE") await new Promise((r) => setTimeout(r, SCRIPTED_STEP_PAUSE_MS));
      }
    } catch (err) {
      // stepRun already fails closed for evaluation errors; anything reaching here stops the run.
      const detail = err instanceof Error ? err.message.split("\n")[0].slice(0, 160) : "unknown error";
      console.error("[IntentGuard runner]", err);
      await prisma.agentRun
        .updateMany({
          where: { id: runId, status: "RUNNING" },
          data: { status: "FAILED", endedAt: new Date(), lastAgentNote: `The run stopped because of an internal error (${detail}). Nothing further was executed.` },
        })
        .catch(() => {});
    } finally {
      driving.delete(runId);
    }
  })();
}
