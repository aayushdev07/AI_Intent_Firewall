import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { LevelText, Tag, decisionColor } from "@/components/ui/badge";
import type { RunDetail } from "@/components/run/types";

function levelOf(score: number) {
  return score >= 70 ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW";
}

/** Current and peak risk plus the trajectory patterns that raised it. */
export function RiskCard({ run }: { run: RunDetail }) {
  const last = run.actions.at(-1);
  const current = last?.riskScore ?? 0;
  const level = last?.riskLevel ?? "LOW";
  const peak = run.trajectory.maxRisk;
  return (
    <Card>
      <CardHeader title="Risk" description="Deterministic score, 0–100. Recomputed for every proposal." />
      <CardBody>
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-xs text-fog-mute">Latest action</div>
            <div className="mt-0.5 font-mono text-4xl font-semibold tabular-nums" style={{ color: decisionColor(level) }}>
              {last ? current : "—"}
            </div>
            <LevelText level={last ? level : null} />
          </div>
          <div className="text-right">
            <div className="text-xs text-fog-mute">Peak this run</div>
            <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums" style={{ color: decisionColor(levelOf(peak)) }}>
              {run.actions.length ? peak : "—"}
            </div>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-3" role="img" aria-label={`Risk ${current} of 100`}>
          <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${last ? current : 0}%`, background: decisionColor(level) }} />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-fog-mute">
          <span>0 LOW</span>
          <span>30 MEDIUM</span>
          <span>70 HIGH</span>
          <span>100</span>
        </div>
        <div className="mt-4">
          <div className="mb-1.5 text-xs text-fog-mute">Trajectory patterns</div>
          {run.trajectory.patternLabels.length ? (
            <div className="flex flex-wrap gap-1.5">
              {run.trajectory.patternLabels.map((p) => (
                <Tag key={p} tone="block">{p}</Tag>
              ))}
            </div>
          ) : (
            <p className="text-sm text-fog-mute">No risky sequence detected.</p>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div>
            <dt className="text-fog-mute">Sensitive data held</dt>
            <dd className={run.trajectory.sensitiveDataHeld ? "text-warn" : "text-fog-dim"}>{run.trajectory.sensitiveDataHeld ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-fog-mute">Untrusted instructions</dt>
            <dd className={run.trajectory.untrustedInstructionsDetected ? "text-block" : "text-fog-dim"}>
              {run.trajectory.untrustedInstructionsDetected ? "Detected — ignored" : "None seen"}
            </dd>
          </div>
        </dl>
      </CardBody>
    </Card>
  );
}
