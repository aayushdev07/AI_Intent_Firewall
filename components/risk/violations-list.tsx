import { Card, CardHeader, Empty } from "@/components/ui/card";
import { Tag, ToolName } from "@/components/ui/badge";
import type { RunAction } from "@/components/run/types";

export function ViolationsList({ actions }: { actions: RunAction[] }) {
  const rows = actions.flatMap((a) => a.violations.map((v) => ({ ...v, seq: a.sequence, tool: a.toolName })));
  return (
    <Card>
      <CardHeader title="Policy violations" description={rows.length ? `${rows.length} in this run` : undefined} />
      {rows.length === 0 ? (
        <Empty>No policy violations.</Empty>
      ) : (
        <ul className="divide-y divide-steel-line">
          {rows.map((v, i) => (
            <li key={i} className="px-4 py-2.5 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Tag tone={v.severity === "HARD" ? "block" : v.severity === "ESCALATE" ? "warn" : "neutral"}>{v.severity}</Tag>
                <span className="font-mono text-xs text-fog-mute">#{v.seq}</span>
                <ToolName name={v.tool} className="text-xs" />
              </div>
              <p className="mt-1 text-fog-dim">{v.message}</p>
              <p className="font-mono text-[11px] text-fog-mute">{v.code}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
