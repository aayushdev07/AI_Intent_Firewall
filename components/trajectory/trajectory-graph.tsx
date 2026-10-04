"use client";
import { useMemo } from "react";
import ReactFlow, { Background, Controls, Handle, MarkerType, Position, type Edge, type Node, type NodeProps } from "reactflow";
import { Card, CardHeader } from "@/components/ui/card";
import { decisionColor } from "@/components/ui/badge";
import type { RunDetail } from "@/components/run/types";
import { formatTime } from "@/lib/utils";

type ActorData = { title: string; subtitle: string; accent: string };
type ActionData = { seq: number; tool: string; decision: string | null; alignment: number | null; risk: number | null; time: string; executed: boolean; tainted: boolean };

function ActorNode({ data }: NodeProps<ActorData>) {
  return (
    <div className="w-[190px] rounded-md border bg-ink-3 px-3 py-2" style={{ borderColor: data.accent }}>
      <Handle type="target" position={Position.Left} className="!border-0 !bg-steel-soft" />
      <div className="text-[11px] font-semibold tracking-wide" style={{ color: data.accent }}>{data.title}</div>
      <div className="mt-0.5 line-clamp-2 text-xs text-fog-dim">{data.subtitle}</div>
      <Handle type="source" position={Position.Right} className="!border-0 !bg-steel-soft" />
    </div>
  );
}

function ActionNode({ data }: NodeProps<ActionData>) {
  const c = decisionColor(data.decision);
  return (
    <div className="w-[200px] rounded-md border-l-4 border border-steel-line bg-ink-2 px-3 py-2" style={{ borderLeftColor: c }}>
      <Handle type="target" position={Position.Left} className="!border-0 !bg-steel-soft" />
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-fog-mute">#{data.seq}</span>
        <span className="font-mono text-[11px] font-semibold" style={{ color: c }}>{data.decision ?? "…"}</span>
      </div>
      <div className="truncate font-mono text-xs text-fog">{data.tool}</div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-fog-mute">
        <span>align {data.alignment ?? "—"}%</span>
        <span>risk {data.risk ?? "—"}</span>
        <span>{data.time}</span>
      </div>
      <div className="mt-0.5 text-[10px] text-fog-mute">
        {data.executed ? "executed" : "not executed"}
        {data.tainted ? " · untrusted content" : ""}
      </div>
      <Handle type="source" position={Position.Right} className="!border-0 !bg-steel-soft" />
    </div>
  );
}

const nodeTypes = { actor: ActorNode, action: ActionNode };

/** USER → ORIGINAL INTENT → WORKER AGENT → action₁ → action₂ … coloured by decision. */
export function TrajectoryGraph({ run, height = 320 }: { run: RunDetail; height?: number }) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [
      { id: "user", type: "actor", position: { x: 0, y: 0 }, data: { title: "USER", subtitle: "Source of authority", accent: "#5A5148" }, draggable: false },
      { id: "intent", type: "actor", position: { x: 230, y: 0 }, data: { title: "ORIGINAL INTENT", subtitle: run.intent.goal, accent: "#1E4D3B" }, draggable: false },
      {
        id: "agent",
        type: "actor",
        position: { x: 460, y: 0 },
        data: { title: "WORKER AGENT", subtitle: run.mode === "LIVE" ? "Agent model · propose only" : run.mode === "SCRIPTED" ? "Scripted replay · propose only" : "Demo worker · propose only", accent: "#5A5148" },
        draggable: false,
      },
    ];
    const edge = (s: string, t: string, color = "#CFC2AE", dashed = false): Edge => ({
      id: `${s}-${t}`,
      source: s,
      target: t,
      style: { stroke: color, strokeWidth: 1.5, strokeDasharray: dashed ? "4 4" : undefined },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
    });
    const edges: Edge[] = [edge("user", "intent", "#1E4D3B"), edge("intent", "agent", "#1E4D3B")];
    const perRow = 4;
    run.actions.forEach((a, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      const x = row % 2 === 0 ? col * 230 : (perRow - 1 - col) * 230;
      nodes.push({
        id: a.id,
        type: "action",
        position: { x, y: 130 + row * 120 },
        data: {
          seq: a.sequence,
          tool: a.toolName,
          decision: a.decision,
          alignment: a.alignmentScore,
          risk: a.riskScore,
          time: formatTime(a.createdAt),
          executed: a.status === "EXECUTED",
          tainted: Boolean(a.resultMeta?.untrusted),
        },
        draggable: false,
      });
      const prev = i === 0 ? "agent" : run.actions[i - 1].id;
      edges.push(edge(prev, a.id, decisionColor(a.decision), a.status !== "EXECUTED"));
    });
    return { nodes, edges };
  }, [run]);

  return (
    <Card>
      <CardHeader
        title="Trajectory"
        description="Every proposal in order. Colour shows the decision; dashed edges lead to actions that did not execute."
      />
      <div style={{ height }} className="w-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          nodesConnectable={false}
          elementsSelectable={false}
          proOptions={{ hideAttribution: true }}
          minZoom={0.3}
        >
          <Background color="#E8E0D2" gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </Card>
  );
}
