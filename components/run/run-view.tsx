"use client";
import { IntentCard } from "@/components/intent/intent-card";
import { AgentStatus, type LivePhase } from "@/components/agent/agent-status";
import { ActionStream } from "@/components/agent/action-stream";
import { TrajectoryGraph } from "@/components/trajectory/trajectory-graph";
import { ProvenanceChain } from "@/components/trajectory/provenance-chain";
import { RiskCard } from "@/components/risk/risk-card";
import { AlignmentChart } from "@/components/risk/alignment-chart";
import { ViolationsList } from "@/components/risk/violations-list";
import { ApprovalPanel } from "@/components/approval/approval-panel";
import { FinalDecisionCard } from "./final-decision-card";
import type { RunDetail } from "./types";

/** Full picture of one agent run. Pure presentation over the server's RunDetail. */
export function RunView({
  run,
  phase = "idle",
  onDecide,
  deciding = false,
}: {
  run: RunDetail;
  phase?: LivePhase;
  onDecide?: (actionId: string, decision: "APPROVE" | "DENY") => void;
  deciding?: boolean;
}) {
  const pending = run.actions.find((a) => a.approval?.decision === "PENDING");
  return (
    <div className="space-y-5">
      {pending && onDecide ? <ApprovalPanel action={pending} run={run} busy={deciding} onDecide={(d) => onDecide(pending.id, d)} /> : null}
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 space-y-5 xl:col-span-2">
          <IntentCard intent={run.intent} compact />
          <ActionStream actions={run.actions} phase={phase} />
          <TrajectoryGraph run={run} />
          <AlignmentChart actions={run.actions} />
        </div>
        <div className="min-w-0 space-y-5">
          <AgentStatus run={run} phase={phase} />
          <FinalDecisionCard run={run} />
          <RiskCard run={run} />
          <ViolationsList actions={run.actions} />
          <ProvenanceChain events={run.provenance} limit={14} />
        </div>
      </div>
    </div>
  );
}
