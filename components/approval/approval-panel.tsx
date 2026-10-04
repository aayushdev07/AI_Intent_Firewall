"use client";
import { useState } from "react";
import { ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LevelText, ToolName } from "@/components/ui/badge";
import type { RunAction, RunDetail } from "@/components/run/types";

/** Human-in-the-loop gate for WARN decisions. Approval covers this single action only. */
export function ApprovalPanel({
  action,
  run,
  onDecide,
  busy,
}: {
  action: RunAction;
  run: RunDetail;
  onDecide: (decision: "APPROVE" | "DENY") => void;
  busy: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const previous = run.actions.filter((a) => a.sequence < action.sequence);
  const dest = action.arguments.to ?? action.arguments.destination;
  const dataRefs = ["attachment", "filename", "content_source", "source"]
    .map((k) => (typeof action.arguments[k] === "string" ? `${k}: ${action.arguments[k]}` : null))
    .filter(Boolean) as string[];
  if (run.trajectory.sensitiveDataHeld) dataRefs.push("Sensitive data was read earlier in this run");
  const rows: [string, React.ReactNode][] = [
    ["User intent", run.intent.goal],
    ["Proposed action", <ToolName key="t" name={action.toolName} />],
    ["Arguments", <code key="a" className="break-all font-mono text-xs text-fog-dim">{JSON.stringify(action.arguments)}</code>],
    ["Agent's reason", action.reason || "—"],
    ["Intent alignment", <span key="al" className="font-mono">{action.alignmentScore}%</span>],
    ["Risk", <span key="r" className="font-mono">{action.riskScore} <LevelText level={action.riskLevel} /></span>],
    ["Why approval is needed", action.decisionReason],
    ["Destination", typeof dest === "string" ? <code key="d" className="font-mono text-xs">{dest}</code> : "None (no external destination)"],
    ["Data involved", dataRefs.length ? dataRefs.join("; ") : "No data references in the arguments"],
    ["Policy concerns", action.violations.map((v) => `${v.code}: ${v.message}`).join("; ") || "Risk score is in the approval band"],
    [
      "Previous actions",
      previous.length ? (
        <span key="p" className="font-mono text-xs text-fog-dim">
          {previous.map((p) => `${p.sequence}. ${p.toolName} (${p.decision ?? "—"})`).join("  ")}
        </span>
      ) : (
        "This is the first action"
      ),
    ],
  ];
  return (
    <section role="alertdialog" aria-labelledby="approval-title" className="rounded-lg border-2 border-warn/60 bg-ink-2">
      <header className="flex items-center gap-2 border-b border-warn/30 bg-warn-bg px-4 py-3">
        <ShieldQuestion className="size-5 text-warn" aria-hidden />
        <h2 id="approval-title" className="font-mono text-sm font-semibold tracking-wide text-warn">ACTION REQUIRES APPROVAL</h2>
      </header>
      <dl className="space-y-2 px-4 py-4 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="grid gap-1 sm:grid-cols-[170px_1fr] sm:gap-3">
            <dt className="text-fog-mute">{k}</dt>
            <dd className="min-w-0 text-fog">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-steel-line px-4 py-3">
        <p className="text-xs text-fog-mute">Approving runs this one action once. It does not approve similar actions later. Unanswered requests are denied after 15 minutes.</p>
        <div className="flex gap-2">
          <Button variant="block" disabled={busy} onClick={() => onDecide("DENY")}>DENY</Button>
          {confirming ? (
            <Button variant="allow" disabled={busy} onClick={() => onDecide("APPROVE")} autoFocus>Confirm: APPROVE ONCE</Button>
          ) : (
            <Button variant="secondary" disabled={busy} onClick={() => setConfirming(true)}>APPROVE ONCE</Button>
          )}
        </div>
      </div>
    </section>
  );
}
