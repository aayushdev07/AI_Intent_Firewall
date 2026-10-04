import type { Stats } from "@/lib/client";

/** All values come from the database via computeStats(); nothing here is hard-coded. */
export function KpiCards({ stats }: { stats: Stats }) {
  const items: { label: string; value: string; color?: string }[] = [
    { label: "Active agent runs", value: String(stats.activeRuns) },
    { label: "Actions evaluated", value: String(stats.actionsEvaluated) },
    { label: "Actions allowed", value: String(stats.actionsAllowed), color: "#2E7A4E" },
    { label: "Warnings", value: String(stats.warnings), color: "#A8650F" },
    { label: "Blocked actions", value: String(stats.blocked), color: "#B3261E" },
    { label: "Average alignment", value: stats.averageAlignment == null ? "—" : `${stats.averageAlignment}%` },
    { label: "Highest risk", value: stats.highestRisk == null ? "—" : String(Math.round(stats.highestRisk)) },
  ];
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-steel-line bg-steel-line sm:grid-cols-4 xl:grid-cols-7" style={{ gap: 1 }}>
      {items.map((k) => (
        <div key={k.label} className="bg-ink-2 px-4 py-3">
          <dt className="text-xs text-fog-mute">{k.label}</dt>
          <dd className="mt-1 font-mono text-2xl font-semibold" style={{ color: k.color ?? "#1E1A16" }}>
            {k.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
