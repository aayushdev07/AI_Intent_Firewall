import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { DemoBanner } from "@/components/dashboard/demo-banner";
import { HeaderStatus } from "@/components/dashboard/header-status";
import { DbUnavailable } from "@/components/layout/page-header";
import { prisma } from "@/lib/db/client";
import { loadStats, safeLoad } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: { run?: string; new?: string } }) {
  const loaded = await safeLoad(async () => {
    const stats = await loadStats();
    let runId = searchParams.run ?? null;
    if (!runId && !searchParams.new) {
      const latest = await prisma.agentRun.findFirst({ orderBy: { startedAt: "desc" }, select: { id: true } });
      runId = latest?.id ?? null;
    }
    if (runId && !(await prisma.agentRun.findUnique({ where: { id: runId }, select: { id: true } }))) runId = null;
    return { stats, runId };
  });

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-steel-line pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-fog">Live monitor</h1>
          <p className="text-sm text-fog-dim">Run tasks step by step and watch every IntentGuard decision. The model proposes, IntentGuard decides.</p>
        </div>
        <HeaderStatus />
      </div>
      <DemoBanner />
      {loaded.ok ? <DashboardClient initialStats={loaded.data.stats} initialRunId={loaded.data.runId} /> : <DbUnavailable message={loaded.error} />}
    </div>
  );
}
