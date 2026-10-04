import Link from "next/link";
import { DbUnavailable, PageHeader } from "@/components/layout/page-header";
import { Card, Empty } from "@/components/ui/card";
import { DecisionBadge, decisionColor } from "@/components/ui/badge";
import { prisma } from "@/lib/db/client";
import { parseJson } from "@/lib/db/json";
import { safeLoad } from "@/lib/server-data";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { RUNNING: "Running", WAITING_APPROVAL: "Waiting for approval", COMPLETED: "Completed", HALTED: "Halted", FAILED: "Failed" };

export default async function TrajectoriesPage() {
  const loaded = await safeLoad(() =>
    prisma.agentRun.findMany({ orderBy: { startedAt: "desc" }, take: 200, include: { intent: { select: { userRequest: true } }, trajectory: true } }),
  );
  return (
    <div className="mx-auto max-w-[1300px]">
      <PageHeader title="Trajectories" description="Each agent run as an ordered chain of proposals and decisions. Open a run to see its graph, receipts and chain of authority." />
      {!loaded.ok ? (
        <DbUnavailable message={loaded.error} />
      ) : (
        <Card>
          {loaded.data.length === 0 ? (
            <Empty>
              No runs yet. <Link href="/simulation" className="text-signal hover:underline">Run a simulation</Link> to create one.
            </Empty>
          ) : (
            <ul className="divide-y divide-steel-line">
              {loaded.data.map((r) => {
                const seq = parseJson<{ tool: string; decision: string }[]>(r.trajectory?.sequence, []);
                return (
                  <li key={r.id}>
                    <Link href={`/trajectories/${r.id}`} className="block px-4 py-3 hover:bg-ink-3/50">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-sm text-fog">{r.intent.userRequest}</span>
                        <span className="flex items-center gap-3 text-xs text-fog-mute">
                          <span>{r.mode === "LIVE" ? "Agent model" : r.mode === "SCRIPTED" ? "Scripted" : "Demo"}</span>
                          <span>{STATUS[r.status] ?? r.status}</span>
                          <span className="font-mono">{formatDateTime(r.startedAt.toISOString())}</span>
                          <DecisionBadge decision={r.finalDecision} />
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1 font-mono text-[11px]">
                        {seq.length === 0 ? <span className="text-fog-mute">No actions</span> : null}
                        {seq.map((s, i) => (
                          <span key={i} className="flex items-center gap-1">
                            {i > 0 ? <span className="text-fog-mute" aria-hidden>→</span> : null}
                            <span className="rounded-sm border px-1.5 py-0.5" style={{ borderColor: decisionColor(s.decision), color: decisionColor(s.decision) }}>
                              {s.tool}
                            </span>
                          </span>
                        ))}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
