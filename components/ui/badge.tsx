import * as React from "react";
import { cn } from "@/lib/utils";
import type { Decision, RiskLevel } from "@/lib/types";

const DECISION_STYLE: Record<Decision, string> = {
  ALLOW: "bg-allow-bg text-allow border-allow/40",
  WARN: "bg-warn-bg text-warn border-warn/40",
  BLOCK: "bg-block-bg text-block border-block/40",
};

export function decisionColor(d: Decision | string | null | undefined): string {
  if (d === "ALLOW" || d === "LOW") return "#2E7A4E";
  if (d === "WARN" || d === "MEDIUM") return "#A8650F";
  if (d === "BLOCK" || d === "HIGH") return "#B3261E";
  return "#8A8074";
}

export function DecisionBadge({ decision, size = "sm", className }: { decision: Decision | string | null | undefined; size?: "sm" | "lg"; className?: string }) {
  if (!decision) return <span className={cn("text-xs text-fog-mute", className)}>Pending</span>;
  const style = DECISION_STYLE[decision as Decision] ?? "bg-ink-3 text-fog-dim border-steel-line";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border font-mono font-semibold tracking-wide",
        size === "lg" ? "px-3 py-1 text-base" : "px-1.5 py-0.5 text-[11px]",
        style,
        className,
      )}
    >
      {decision}
    </span>
  );
}

export function LevelText({ level, className }: { level: RiskLevel | string | null | undefined; className?: string }) {
  if (!level) return <span className="text-fog-mute">—</span>;
  return (
    <span className={cn("font-mono text-xs font-semibold", className)} style={{ color: decisionColor(level) }}>
      {level}
    </span>
  );
}

export function Tag({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: "neutral" | "allow" | "warn" | "block" | "signal"; className?: string }) {
  const tones = {
    neutral: "border-steel-line bg-ink-3 text-fog-dim",
    allow: "border-allow/30 bg-allow-bg text-allow",
    warn: "border-warn/30 bg-warn-bg text-warn",
    block: "border-block/30 bg-block-bg text-block",
    signal: "border-signal/30 bg-signal/10 text-signal",
  };
  return <span className={cn("inline-flex items-center rounded-sm border px-1.5 py-0.5 text-xs", tones[tone], className)}>{children}</span>;
}

export function ToolName({ name, className }: { name: string; className?: string }) {
  return <code className={cn("font-mono text-[13px] text-fog", className)}>{name}</code>;
}

export function StatusDot({ tone }: { tone: "allow" | "warn" | "block" | "mute" }) {
  const c = { allow: "bg-allow", warn: "bg-warn", block: "bg-block", mute: "bg-fog-mute" }[tone];
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", c)} />;
}
