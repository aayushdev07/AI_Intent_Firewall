import type { RunDetail } from "@/lib/services/run-service";
import type { IntentView } from "@/lib/db/mappers";

/** Client-side views of server read models (type-only imports; no server code is bundled). */
export type { RunDetail, IntentView };
export type RunAction = RunDetail["actions"][number];
export type Provenance = RunDetail["provenance"][number];

export const MODE_LABEL: Record<string, string> = {
  LIVE: "Qwen3-8B (live)",
  DEMO: "Demo worker",
  SCRIPTED: "Scripted replay",
};

export const STATUS_LABEL: Record<string, string> = {
  RUNNING: "Running",
  WAITING_APPROVAL: "Waiting for approval",
  COMPLETED: "Completed",
  HALTED: "Halted",
  FAILED: "Failed",
};

export type Run = RunDetail;
