import Link from "next/link";
import { notFound } from "next/navigation";
import { DbUnavailable, PageHeader } from "@/components/layout/page-header";
import { IntentCard } from "@/components/intent/intent-card";
import { Card, CardHeader, Empty } from "@/components/ui/card";
import { DecisionBadge } from "@/components/ui/badge";
import { prisma } from "@/lib/db/client";
import { intentView } from "@/lib/db/mappers";
import { safeLoad } from "@/lib/server-data";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function IntentDetailPage({ params }: { params: { id: string } }) {
  const loaded = await safeLoad(() =>
    prisma.intent.findUnique({ where: { id: params.id }, include: { runs: { orderBy: { startedAt: "desc" }, include: { _count: { select: { actions: true } } } } } }),
  );
  if (!loaded.ok) return <DbUnavailable message={loaded.error} />;
  if (!loaded.data) notFound();
  const row = loaded.data;
  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      <PageHeader title="Original Intent" description={<Link href="/intents" className="text-signal hover:underline">All intents</Link>} />
      <IntentCard intent={intentView(row)} />
      <Card>
        <CardHeader title="Agent runs under this intent" />
        {row.runs.length === 0 ? (
          <Empty>{row.status === "CONFIRMED" ? "No runs yet." : "This draft was never confirmed, so no agent ran under it."}</Empty>
        ) : (
          <ul className="divide-y divide-steel-line">
            {row.runs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <Link href={`/trajectories/${r.id}`} className="font-mono text-fog hover:text-signal">
                  {r.id.slice(-8).toUpperCase()}
                </Link>
                <span className="text-fog-dim">{r.mode === "LIVE" ? "Agent model" : r.mode === "SCRIPTED" ? `Scripted (${r.scenario})` : "Demo worker"}</span>
                <span className="text-fog-dim">{r._count.actions} actions</span>
                <span className="font-mono text-xs text-fog-mute">{formatDateTime(r.startedAt.toISOString())}</span>
                <DecisionBadge decision={r.finalDecision} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
