import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { DecisionBadge } from "@/components/ui/badge";
import { STATUS_LABEL, type RunDetail } from "./types";

/** Outcome of the run: the most severe decision made, and what was executed. */
export function FinalDecisionCard({ run }: { run: RunDetail }) {
  const executed = run.actions.filter((a) => a.status === "EXECUTED").length;
  const blocked = run.actions.filter((a) => a.decision === "BLOCK").length;
  const warned = run.actions.filter((a) => a.decision === "WARN").length;
  const done = run.status === "COMPLETED" || run.status === "HALTED" || run.status === "FAILED";
  const latest = run.actions.at(-1);
  const shown = done ? run.finalDecision : latest?.decision ?? null;
  return (
    <Card>
      <CardHeader title={done ? "Final decision" : "Latest decision"} description={done ? `Run ${STATUS_LABEL[run.status]?.toLowerCase()}` : "Updates with every proposal"} />
      <CardBody>
        <div className="flex items-center gap-3">
          {shown ? <DecisionBadge decision={shown} size="lg" /> : <span className="text-sm text-fog-mute">No decision yet</span>}
          {done && run.finalDecision ? <span className="text-xs text-fog-mute">Most severe decision in the run</span> : null}
        </div>
        <p className="mt-3 text-sm text-fog-dim">{done ? run.lastAgentNote ?? "" : latest?.decisionReason ?? "Waiting for the first proposal."}</p>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-ink-3 py-2">
            <dt className="text-[11px] text-fog-mute">Executed</dt>
            <dd className="font-mono text-lg text-allow">{executed}</dd>
          </div>
          <div className="rounded-md bg-ink-3 py-2">
            <dt className="text-[11px] text-fog-mute">Approval</dt>
            <dd className="font-mono text-lg text-warn">{warned}</dd>
          </div>
          <div className="rounded-md bg-ink-3 py-2">
            <dt className="text-[11px] text-fog-mute">Blocked</dt>
            <dd className="font-mono text-lg text-block">{blocked}</dd>
          </div>
        </dl>
        {!run.intentIntact ? <p className="mt-3 text-sm text-block">Original Intent integrity check failed.</p> : null}
      </CardBody>
    </Card>
  );
}
