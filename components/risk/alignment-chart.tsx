"use client";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardBody, CardHeader, Empty } from "@/components/ui/card";
import { decisionColor } from "@/components/ui/badge";
import type { RunAction } from "@/components/run/types";

/** Alignment per action (bars, coloured by decision) against risk (line). */
export function AlignmentChart({ actions }: { actions: RunAction[] }) {
  const data = actions.map((a) => ({
    name: `#${a.sequence}`,
    tool: a.toolName,
    alignment: a.alignmentScore ?? 0,
    risk: a.riskScore ?? 0,
    decision: a.decision,
  }));
  return (
    <Card>
      <CardHeader title="Intent alignment over time" description="Bars: alignment with the Original Intent (%). Line: risk score." />
      {data.length === 0 ? (
        <Empty>Alignment appears here once the agent proposes its first action.</Empty>
      ) : (
        <CardBody>
          <div className="h-56" role="img" aria-label={`Alignment and risk for ${data.length} actions`}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid stroke="#E0D6C6" vertical={false} />
                <XAxis dataKey="name" stroke="#8A8074" tickLine={false} fontSize={11} />
                <YAxis domain={[0, 100]} stroke="#8A8074" tickLine={false} fontSize={11} ticks={[0, 30, 70, 100]} />
                <ReferenceLine y={70} stroke="#B3261E" strokeDasharray="3 3" strokeOpacity={0.5} />
                <ReferenceLine y={30} stroke="#A8650F" strokeDasharray="3 3" strokeOpacity={0.5} />
                <Tooltip
                  cursor={{ fill: "rgba(30,77,59,0.06)" }}
                  contentStyle={{ background: "#FFFDF9", border: "1px solid #E0D6C6", borderRadius: 7, fontSize: 12 }}
                  labelStyle={{ color: "#1E1A16" }}
                  formatter={(v, k) => [String(v), k === "alignment" ? "Alignment %" : "Risk"]}
                  labelFormatter={(l, p) => `${l} ${(p?.[0]?.payload as { tool?: string } | undefined)?.tool ?? ""}`}
                />
                <Bar dataKey="alignment" radius={[3, 3, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                  {data.map((d) => (
                    <Cell key={d.name} fill={decisionColor(d.decision)} fillOpacity={0.85} />
                  ))}
                </Bar>
                <Line dataKey="risk" stroke="#1E1A16" strokeWidth={1.5} dot={{ r: 3, fill: "#1E1A16" }} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardBody>
      )}
    </Card>
  );
}
