import { Card, CardHeader, Empty } from "@/components/ui/card";
import type { Provenance } from "@/components/run/types";
import { cn, formatTime } from "@/lib/utils";

/** Who asked for what, on whose authority. External content never appears as an authority source. */
export function ProvenanceChain({ events, limit }: { events: Provenance[]; limit?: number }) {
  const shown = limit ? events.slice(-limit) : events;
  return (
    <Card>
      <CardHeader title="Provenance chain" description="Each step records its actor, parent and the authority it acted under." />
      {shown.length === 0 ? (
        <Empty>No events recorded.</Empty>
      ) : (
        <ol className="relative space-y-0 px-4 py-3">
          {shown.map((e, i) => {
            const rejected = e.authoritySource.includes("rejected");
            return (
              <li key={e.id} className="relative grid grid-cols-[14px_1fr] gap-3 pb-3 last:pb-0">
                <span className="relative flex justify-center" aria-hidden>
                  <span className={cn("mt-1.5 size-2 rounded-full", rejected ? "bg-block" : e.actor === "IntentGuard" ? "bg-signal" : "bg-fog-mute")} />
                  {i < shown.length - 1 ? <span className="absolute top-4 h-[calc(100%-8px)] w-px bg-steel-line" /> : null}
                </span>
                <div className="min-w-0 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-medium text-fog">{e.actor}</span>
                    <span className="font-mono text-[11px] text-fog-mute">{formatTime(e.createdAt)}</span>
                  </div>
                  <p className="text-fog-dim">{e.action}</p>
                  <p className={cn("break-words font-mono text-[11px]", rejected ? "text-block" : "text-fog-mute")}>
                    {e.parent ? `parent: ${e.parent} · ` : ""}authority: {e.authoritySource}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
