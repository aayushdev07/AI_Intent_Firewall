import Link from "next/link";
import { notFound } from "next/navigation";
import { DbUnavailable, PageHeader } from "@/components/layout/page-header";
import { RunView } from "@/components/run/run-view";
import { loadRunOrNull, safeLoad } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export default async function TrajectoryDetailPage({ params }: { params: { runId: string } }) {
  const loaded = await safeLoad(() => loadRunOrNull(params.runId));
  if (!loaded.ok) return <DbUnavailable message={loaded.error} />;
  const run = loaded.data;
  if (!run) notFound();
  const active = run.status === "RUNNING" || run.status === "WAITING_APPROVAL";
  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        title={`Run ${run.id.slice(-8).toUpperCase()}`}
        description={<>“{run.intent.userRequest}”</>}
        actions={
          <>
            <Link href="/trajectories" className="text-sm text-fog-dim hover:text-fog">All trajectories</Link>
            {active ? (
              <Link href={`/dashboard?run=${run.id}`} className="rounded-md bg-signal px-3 py-1.5 text-sm font-medium text-white hover:bg-signal/90">
                Continue on dashboard
              </Link>
            ) : null}
            <Link href={`/receipts?q=${run.id}`} className="text-sm text-signal hover:underline">Receipts</Link>
          </>
        }
      />
      <RunView run={run} />
    </div>
  );
}
