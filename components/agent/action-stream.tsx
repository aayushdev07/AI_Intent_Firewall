"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight, ShieldAlert } from "lucide-react";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { DecisionBadge, LevelText, Tag, ToolName } from "@/components/ui/badge";
import type { RunAction } from "@/components/run/types";
import type { LivePhase } from "./agent-status";
import { cn, formatTime } from "@/lib/utils";
import { EvaluationBreakdown } from "@/components/risk/evaluation-breakdown";

function statusText(a: RunAction) {
  if (a.status === "EXECUTED") return a.approval?.decision === "APPROVED" ? "Executed after approval" : "Executed";
  if (a.status === "BLOCKED") return "Not executed";
  if (a.status === "WARNED") return a.approval?.decision === "DENIED" ? "Denied — not executed" : a.approval?.decision === "PENDING" ? "Awaiting approval" : "Not executed";
  if (a.status === "ALLOWED") return "Allowed — execution refused by guard";
  return a.status;
}

function argsPreview(args: Record<string, unknown>) {
  const s = Object.entries(args)
    .map(([k, v]) => `${k}=${typeof v === "string" ? JSON.stringify(v.length > 40 ? v.slice(0, 40) + "…" : v) : JSON.stringify(v)}`)
    .join(", ");
  return s || "no arguments";
}

/** Chronological list of every proposal and the firewall's decision on it. */
export function ActionStream({ actions, phase, title = "Live action stream" }: { actions: RunAction[]; phase?: LivePhase; title?: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader title={title} description="Each proposal from the worker agent and what IntentGuard decided." />
      {actions.length === 0 && (!phase || phase === "idle") ? <Empty>No actions proposed yet.</Empty> : null}
      <ol className="divide-y divide-steel-line">
        {actions.map((a) => {
          const expanded = open === a.id;
          return (
            <li key={a.id} className="ig-enter">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : a.id)}
                aria-expanded={expanded}
                className="grid w-full grid-cols-[20px_1fr_auto] items-start gap-3 px-4 py-3 text-left hover:bg-ink-3/60"
              >
                {expanded ? <ChevronDown className="mt-0.5 size-4 text-fog-mute" /> : <ChevronRight className="mt-0.5 size-4 text-fog-mute" />}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-fog-mute">#{a.sequence}</span>
                    <ToolName name={a.toolName} />
                    {a.resultMeta?.injectionDetected ? (
                      <Tag tone="block"><ShieldAlert className="mr-1 size-3" />Injected instructions found</Tag>
                    ) : a.resultMeta?.untrusted ? (
                      <Tag tone="warn">Untrusted content</Tag>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-xs text-fog-mute">{argsPreview(a.arguments)}</p>
                  <p className="mt-1 text-sm text-fog-dim">{a.decisionReason}</p>
                </div>
                <div className="flex flex-col items-end gap-1 text-right">
                  <DecisionBadge decision={a.decision} />
                  <span className="font-mono text-xs text-fog-dim">
                    {a.alignmentScore ?? "—"}% · <LevelText level={a.riskLevel} /> {a.riskScore ?? "—"}
                  </span>
                  <span className={cn("text-[11px]", a.status === "EXECUTED" ? "text-allow" : "text-fog-mute")}>{statusText(a)}</span>
                  <span className="font-mono text-[11px] text-fog-mute">{formatTime(a.createdAt)}</span>
                </div>
              </button>
              {expanded ? (
                <div className="border-t border-steel-line bg-ink/50 px-4 py-4 sm:pl-12">
                  <EvaluationBreakdown action={a} />
                </div>
              ) : null}
            </li>
          );
        })}
        {phase && phase !== "idle" ? (
          <li className="flex items-center gap-3 px-4 py-3 text-sm text-fog-dim" aria-live="polite">
            <span className="inline-block size-2 animate-pulse rounded-full bg-signal" aria-hidden />
            {phase === "proposing" ? "Worker agent is proposing an action…" : "IntentGuard is checking intent, trajectory, risk and policy…"}
          </li>
        ) : null}
      </ol>
    </Card>
  );
}
