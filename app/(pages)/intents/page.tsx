import Link from "next/link";
import { DbUnavailable, PageHeader } from "@/components/layout/page-header";
import { Card, Empty } from "@/components/ui/card";
import { DecisionBadge, Tag } from "@/components/ui/badge";
import { prisma } from "@/lib/db/client";
import { safeLoad } from "@/lib/server-data";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function IntentsPage() {
  const loaded = await safeLoad(() =>
    prisma.intent.findMany({
      where: { kind: "TASK" },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { runs: { select: { id: true, finalDecision: true, status: true }, orderBy: { startedAt: "desc" } } },
    }),
  );
  return (
    <div className="mx-auto max-w-[1300px]">
      <PageHeader
        title="Intents"
        description="Every Original Intent extracted from a user task. Confirmed intents are immutable and sealed with a SHA-256 hash; drafts were never confirmed and never ran."
      />
      {!loaded.ok ? (
        <DbUnavailable message={loaded.error} />
      ) : (
        <Card>
          {loaded.data.length === 0 ? (
            <Empty>
              No intents yet. <Link href="/dashboard?new=1" className="text-signal hover:underline">Give the agent a task</Link> to create one.
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-steel-line text-xs text-fog-mute">
                    <th className="px-4 py-2 font-medium">Created</th>
                    <th className="px-4 py-2 font-medium">User request</th>
                    <th className="px-4 py-2 font-medium">Goal</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Parser</th>
                    <th className="px-4 py-2 font-medium">Runs</th>
                  </tr>
                </thead>
                <tbody>
                  {loaded.data.map((i) => (
                    <tr key={i.id} className="border-b border-steel-line/60 hover:bg-ink-3/50">
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-fog-dim">{formatDateTime(i.createdAt.toISOString())}</td>
                      <td className="max-w-xs px-4 py-2.5">
                        <Link href={`/intents/${i.id}`} className="text-fog hover:text-signal">
                          {i.userRequest}
                        </Link>
                      </td>
                      <td className="max-w-xs truncate px-4 py-2.5 text-fog-dim" title={i.goal}>{i.goal}</td>
                      <td className="px-4 py-2.5">{i.status === "CONFIRMED" ? <Tag tone="allow">Confirmed</Tag> : <Tag>Draft</Tag>}</td>
                      <td className="px-4 py-2.5 text-xs text-fog-dim">{i.parserSource === "LLM" ? "Agent model" : "Rule-based"}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          {i.runs.length === 0 ? <span className="text-xs text-fog-mute">—</span> : null}
                          {i.runs.slice(0, 4).map((r) => (
                            <Link key={r.id} href={`/trajectories/${r.id}`} aria-label={`Run ${r.id}`}>
                              <DecisionBadge decision={r.finalDecision ?? (r.status === "COMPLETED" ? null : r.status)} />
                            </Link>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
