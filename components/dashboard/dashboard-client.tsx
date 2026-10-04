"use client";
import { useCallback, useState } from "react";
import { KpiCards } from "./kpi-cards";
import { ModelStatusCard } from "./model-status-card";
import { RunConsole } from "@/components/run/run-console";
import { api, type Stats } from "@/lib/client";

export function DashboardClient({ initialStats, initialRunId }: { initialStats: Stats; initialRunId: string | null }) {
  const [stats, setStats] = useState(initialStats);
  // KPIs are re-read from the database after every step, approval or new run.
  const refreshStats = useCallback(() => {
    api<Stats>("/api/stats").then(setStats).catch(() => {});
  }, []);

  return (
    <div className="space-y-5">
      <KpiCards stats={stats} />
      <div className="grid gap-5 2xl:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <RunConsole initialRunId={initialRunId ?? undefined} onActivity={refreshStats} syncUrl />
        </div>
        <div className="space-y-5">
          <ModelStatusCard />
        </div>
      </div>
    </div>
  );
}
