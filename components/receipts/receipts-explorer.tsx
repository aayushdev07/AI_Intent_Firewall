"use client";
import { Fragment, useEffect, useState } from "react";
import { Ban, Check, ChevronRight, CircleSlash, PauseCircle, Search } from "lucide-react";
import Link from "next/link";
import { Card, Empty } from "@/components/ui/card";
import { DecisionBadge, LevelText, Tag, ToolName } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { api } from "@/lib/client";
import { attemptText, plainReason } from "@/lib/plain";
import { cn, formatDateTime } from "@/lib/utils";

type Receipt = {
  receiptId: string;
  timestamp: string;
  userIntent: string;
  intentHash: string | null;
  runId: string;
  actionId: string;
  sequence: number;
  agent: string;
  proposedBy: string;
  action: string;
  arguments: Record<string, unknown>;
  agentReason: string;
  alignment: number;
  risk: number;
  riskLevel: string;
  decision: string;
  reason: string;
  violations: string[];
  policyCodes: string[];
  patterns: string[];
  alignmentFactors: { label: string; points: number }[];
  riskFactors: { label: string; points: number }[];
  evaluationSteps: { step: string; ok: boolean; note?: string }[];
  failSafe: boolean;
  executed: boolean;
  approvalStatus: string | null;
  conversationId: string | null;
};

function outcome(r: Receipt): { label: string; tone: string; icon: React.ReactNode } {
  if (r.decision === "BLOCK") return { label: "Blocked by IntentGuard", tone: "text-block", icon: <Ban className="size-3.5 text-block" aria-hidden /> };
  if (r.approvalStatus === "PENDING") return { label: "Waiting for you", tone: "text-warn", icon: <PauseCircle className="size-3.5 text-warn" aria-hidden /> };
  if (r.approvalStatus === "DENIED") return { label: "Blocked by you", tone: "text-fog-dim", icon: <CircleSlash className="size-3.5 text-fog-mute" aria-hidden /> };
  if (r.executed) return { label: r.approvalStatus === "APPROVED" ? "Allowed by you, done" : "Done", tone: "text-allow", icon: <Check className="size-3.5 text-allow" aria-hidden /> };
  return { label: "Not carried out", tone: "text-fog-dim", icon: <CircleSlash className="size-3.5 text-fog-mute" aria-hidden /> };
}

export function ReceiptsExplorer({ initialQuery = "", showWorking = false }: { initialQuery?: string; showWorking?: boolean }) {
  const [q, setQ] = useState(initialQuery);
  const [decision, setDecision] = useState("");
  const [level, setLevel] = useState("");
  const [rows, setRows] = useState<Receipt[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = { cancelled: false };
    const t = setTimeout(() => {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set("q", q.trim());
      if (decision) sp.set("decision", decision);
      if (level) sp.set("level", level);
      api<{ receipts: Receipt[] }>(`/api/receipts?${sp.toString()}`)
        .then((r) => {
          if (!ctrl.cancelled) {
            setRows(r.receipts);
            setError(null);
          }
        })
        .catch((e) => !ctrl.cancelled && setError((e as Error).message));
    }, 250);
    return () => {
      ctrl.cancelled = true;
      clearTimeout(t);
    };
  }, [q, decision, level]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-fog-mute" aria-hidden />
          <Input aria-label="Search receipts" className="pl-9" placeholder={showWorking ? "Search tool, receipt ID, intent, reason, run ID…" : "Search what the assistant did…"} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select aria-label="Filter by decision" className="w-40" value={decision} onChange={(e) => setDecision(e.target.value)}>
          <option value="">{showWorking ? "All decisions" : "Everything"}</option>
          <option value="ALLOW">{showWorking ? "ALLOW" : "Allowed"}</option>
          <option value="WARN">{showWorking ? "WARN" : "Needed my approval"}</option>
          <option value="BLOCK">{showWorking ? "BLOCK" : "Blocked"}</option>
        </Select>
        {showWorking ? (
        <Select aria-label="Filter by risk level" className="w-40" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">All risk levels</option>
          <option value="LOW">LOW</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="HIGH">HIGH</option>
        </Select>
        ) : null}
      </div>
      {error ? (
        <div role="alert" className="rounded-md border border-block/40 bg-block-bg px-4 py-3 text-sm text-fog">{error}</div>
      ) : null}
      <Card>
        {rows === null ? (
          <Empty>Loading receipts…</Empty>
        ) : rows.length === 0 ? (
          <Empty>Nothing here yet. Every step the assistant tries, allowed or blocked, gets a receipt.</Empty>
        ) : !showWorking ? (
          <ul className="divide-y divide-steel-line/70">
            {rows.map((r) => {
              const o = outcome(r);
              const isOpen = open === r.receiptId;
              const why = plainReason(r.decision, (r.policyCodes ?? []).map((code) => ({ code })), r.alignment);
              return (
                <li key={r.receiptId}>
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.receiptId)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-ink-3/50">
                    <span className="mt-[3px] flex size-5 shrink-0 items-center justify-center rounded-full bg-ink-3">{o.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-fog">
                        {attemptText(r.action, r.arguments).replace(/^./, (c) => c.toUpperCase())}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-fog-mute">For: “{r.userIntent}”</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={cn("block text-xs font-medium", o.tone)}>{o.label}</span>
                      <span className="block text-[11px] text-fog-mute">{formatDateTime(r.timestamp)}</span>
                    </span>
                  </button>
                  {isOpen ? (
                    <div className="space-y-2 px-4 pb-4 pl-12 text-sm">
                      <p className="text-fog-dim">{r.decision === "ALLOW" ? "This step matched what you asked for." : why}</p>
                      <p className="text-xs text-fog-mute">
                        Receipt <span className="font-mono">{r.receiptId}</span>
                        {r.conversationId ? (
                          <>
                            {" "}
                            <Link href={`/chat/${r.conversationId}`} className="text-signal hover:underline">
                              Open chat
                            </Link>
                          </>
                        ) : null}
                      </p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-steel-line text-xs text-fog-mute">
                  <th className="px-4 py-2 font-medium">Receipt</th>
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                  <th className="px-4 py-2 font-medium">User intent</th>
                  <th className="px-4 py-2 font-medium">Alignment</th>
                  <th className="px-4 py-2 font-medium">Risk</th>
                  <th className="px-4 py-2 font-medium">Decision</th>
                  <th className="px-4 py-2 font-medium">Executed</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isOpen = open === r.receiptId;
                  return (
                    <Fragment key={r.receiptId}>
                      <tr className={cn("cursor-pointer border-b border-steel-line/60 hover:bg-ink-3/50", isOpen && "bg-ink-3/50")} onClick={() => setOpen(isOpen ? null : r.receiptId)}>
                        <td className="px-4 py-2.5">
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            className="flex items-center gap-1 font-mono text-xs text-signal"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpen(isOpen ? null : r.receiptId);
                            }}
                          >
                            <ChevronRight className={cn("size-3 transition-transform", isOpen && "rotate-90")} aria-hidden />
                            {r.receiptId}
                          </button>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-fog-dim">{formatDateTime(r.timestamp)}</td>
                        <td className="px-4 py-2.5"><ToolName name={r.action} /></td>
                        <td className="max-w-[16rem] truncate px-4 py-2.5 text-fog-dim" title={r.userIntent}>{r.userIntent}</td>
                        <td className="px-4 py-2.5 font-mono">{Math.round(r.alignment)}%</td>
                        <td className="px-4 py-2.5"><span className="font-mono">{Math.round(r.risk)}</span> <LevelText level={r.riskLevel} /></td>
                        <td className="px-4 py-2.5"><DecisionBadge decision={r.decision} /></td>
                        <td className="px-4 py-2.5 text-xs">
                          {r.executed ? <span className="text-allow">Yes</span> : <span className="text-fog-mute">No</span>}
                          {r.approvalStatus ? <span className="ml-1 text-fog-mute">({r.approvalStatus.toLowerCase()})</span> : null}
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr className="border-b border-steel-line bg-ink/60">
                          <td colSpan={8} className="px-5 py-4">
                            <div className="grid gap-5 text-sm lg:grid-cols-3">
                              <div className="space-y-3">
                                <div>
                                  <h4 className="text-xs text-fog-mute">Reason</h4>
                                  <p className="mt-1 text-fog">{r.reason}</p>
                                </div>
                                <div>
                                  <h4 className="text-xs text-fog-mute">Agent&apos;s stated reason</h4>
                                  <p className="mt-1 text-fog-dim">{r.agentReason || "—"}</p>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  <Tag>Proposed by {r.proposedBy === "LLM" ? "Agent model" : r.proposedBy.toLowerCase()}</Tag>
                                  {r.failSafe ? <Tag tone="block">Fail-safe decision</Tag> : null}
                                  <Link href={`/trajectories/${r.runId}`} className="text-xs text-signal hover:underline" onClick={(e) => e.stopPropagation()}>
                                    Open run
                                  </Link>
                                </div>
                                <div>
                                  <h4 className="text-xs text-fog-mute">Arguments</h4>
                                  <pre className="mt-1 max-h-40 overflow-auto rounded-md border border-steel-line bg-ink p-2 font-mono text-xs text-fog-dim">{JSON.stringify(r.arguments, null, 2)}</pre>
                                </div>
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <h4 className="text-xs text-fog-mute">Violations</h4>
                                  {r.violations.length ? (
                                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-fog-dim">
                                      {r.violations.map((v, i) => <li key={i}>{v}</li>)}
                                    </ul>
                                  ) : (
                                    <p className="mt-1 text-fog-mute">None</p>
                                  )}
                                </div>
                                <div>
                                  <h4 className="text-xs text-fog-mute">Evaluation steps</h4>
                                  <ul className="mt-1 space-y-0.5 text-xs">
                                    {r.evaluationSteps.map((s, i) => (
                                      <li key={i} className={s.ok ? "text-fog-dim" : "text-block"}>
                                        {s.ok ? "✓" : "✗"} {s.step}
                                        {s.note ? <span className="text-fog-mute">: {s.note}</span> : null}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                              <div className="space-y-3 text-xs">
                                <div>
                                  <h4 className="text-fog-mute">Alignment factors</h4>
                                  <ul className="mt-1 space-y-0.5">
                                    {r.alignmentFactors.map((f, i) => (
                                      <li key={i} className="flex justify-between gap-2 text-fog-dim"><span>{f.label}</span><span className="font-mono">{f.points > 0 ? "+" : ""}{f.points}</span></li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <h4 className="text-fog-mute">Risk factors</h4>
                                  <ul className="mt-1 space-y-0.5">
                                    {r.riskFactors.map((f, i) => (
                                      <li key={i} className="flex justify-between gap-2 text-fog-dim"><span>{f.label}</span><span className="font-mono">{f.points > 0 ? "+" : ""}{f.points}</span></li>
                                    ))}
                                  </ul>
                                </div>
                                {r.intentHash ? <p className="break-all font-mono text-[11px] text-fog-mute">Intent SHA-256 {r.intentHash}</p> : null}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
