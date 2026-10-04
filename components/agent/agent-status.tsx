import { Bot } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusDot, ToolName } from "@/components/ui/badge";
import { MODE_LABEL, STATUS_LABEL, type RunDetail } from "@/components/run/types";
import { duration, shortId } from "@/lib/utils";

export type LivePhase = "idle" | "proposing" | "evaluating";

export function AgentStatus({ run, phase }: { run: RunDetail; phase: LivePhase }) {
  const tone =
    run.status === "RUNNING" ? "allow" : run.status === "WAITING_APPROVAL" ? "warn" : run.status === "COMPLETED" ? "mute" : "block";
  const last = run.actions.at(-1);
  const activity =
    phase === "proposing"
      ? "Worker agent is proposing the next action…"
      : phase === "evaluating"
        ? "IntentGuard is evaluating the proposal…"
        : run.status === "WAITING_APPROVAL"
          ? "Paused until you approve or deny the pending action."
          : run.status === "RUNNING"
            ? "Ready for the next step."
            : run.lastAgentNote ?? STATUS_LABEL[run.status];
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><Bot className="size-4 text-fog-mute" aria-hidden />Agent status</span>} description={`Run ${shortId(run.id)}`} />
      <CardBody>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-fog-mute">State</dt>
            <dd className="mt-0.5 flex items-center gap-2 text-fog"><StatusDot tone={tone} />{STATUS_LABEL[run.status] ?? run.status}</dd>
          </div>
          <div>
            <dt className="text-xs text-fog-mute">Worker</dt>
            <dd className="mt-0.5 text-fog">{MODE_LABEL[run.mode] ?? run.mode}</dd>
          </div>
          <div>
            <dt className="text-xs text-fog-mute">Steps</dt>
            <dd className="mt-0.5 font-mono text-fog">{run.actions.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-fog-mute">Elapsed</dt>
            <dd className="mt-0.5 font-mono text-fog">{duration(run.startedAt, run.endedAt)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-fog-mute">Last proposal</dt>
            <dd className="mt-0.5">{last ? <ToolName name={last.toolName} /> : <span className="text-fog-mute">None yet</span>}</dd>
          </div>
        </dl>
        <p className="mt-3 border-t border-steel-line pt-3 text-sm text-fog-dim" aria-live="polite">
          {phase !== "idle" ? <span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-signal align-middle" aria-hidden /> : null}
          {activity}
        </p>
        {run.scenario && run.mode === "SCRIPTED" ? <p className="mt-2 text-xs text-fog-mute">Scenario: {run.scenario}. Proposals are replayed from a script; every evaluation is computed live.</p> : null}
      </CardBody>
    </Card>
  );
}
