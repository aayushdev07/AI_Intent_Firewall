import type { RunAction } from "@/components/run/types";
import { Tag } from "@/components/ui/badge";

function Factors({ title, items, sign }: { title: string; items: { label: string; points: number }[]; sign: "risk" | "align" }) {
  return (
    <div>
      <div className="mb-1.5 text-xs text-fog-mute">{title}</div>
      {items.length === 0 ? (
        <p className="text-sm text-fog-mute">No factors recorded.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.map((f, i) => (
            <li key={i} className="flex justify-between gap-4">
              <span className="text-fog-dim">{f.label}</span>
              <span
                className={
                  "shrink-0 font-mono " +
                  (sign === "risk" ? (f.points > 0 ? "text-block" : "text-allow") : f.points >= 0 ? "text-allow" : "text-block")
                }
              >
                {f.points > 0 ? "+" : ""}
                {f.points}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Why the decision was made: every factor that moved the scores, plus violated rules. */
export function EvaluationBreakdown({ action }: { action: RunAction }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-fog-mute">Agent&apos;s stated reason</div>
        <p className="mt-0.5 text-sm text-fog-dim">{action.reason || "—"}</p>
      </div>
      <div>
        <div className="text-xs text-fog-mute">Arguments</div>
        <pre className="mt-1 overflow-x-auto rounded-md border border-steel-line bg-ink p-2 font-mono text-xs text-fog-dim">{JSON.stringify(action.arguments, null, 2)}</pre>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Factors title={`Intent alignment → ${action.alignmentScore ?? "—"}%`} items={action.alignmentFactors} sign="align" />
        <Factors title={`Risk → ${action.riskScore ?? "—"} (${action.riskLevel ?? "—"})`} items={action.riskFactors} sign="risk" />
      </div>
      {action.violations.length ? (
        <div>
          <div className="mb-1.5 text-xs text-fog-mute">Policy violations</div>
          <ul className="space-y-1 text-sm">
            {action.violations.map((v) => (
              <li key={v.code + v.message} className="flex flex-wrap items-center gap-2">
                <Tag tone={v.severity === "HARD" ? "block" : v.severity === "ESCALATE" ? "warn" : "neutral"}>{v.severity}</Tag>
                <span className="font-mono text-xs text-fog-mute">{v.code}</span>
                <span className="text-fog-dim">{v.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <dl className="grid gap-2 text-xs sm:grid-cols-3">
        <div>
          <dt className="text-fog-mute">Proposed by</dt>
          <dd className="text-fog-dim">{action.proposedBy}</dd>
        </div>
        <div>
          <dt className="text-fog-mute">Authority source</dt>
          <dd className="break-words text-fog-dim">{action.authoritySource}</dd>
        </div>
        <div>
          <dt className="text-fog-mute">Receipt</dt>
          <dd className="font-mono text-fog-dim">{action.receiptId ?? "—"}</dd>
        </div>
      </dl>
      {action.result !== null && action.status === "EXECUTED" ? (
        <details>
          <summary className="cursor-pointer text-xs text-fog-mute hover:text-fog">Simulated tool output</summary>
          <pre className="mt-1 max-h-64 overflow-auto rounded-md border border-steel-line bg-ink p-2 font-mono text-xs text-fog-dim">{JSON.stringify(action.result, null, 2)}</pre>
        </details>
      ) : null}
    </div>
  );
}
