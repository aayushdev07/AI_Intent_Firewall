"use client";
import { StatusDot } from "@/components/ui/badge";
import { modelState, useHealth } from "@/components/layout/health-provider";

export function HeaderStatus() {
  const { health, loading } = useHealth();
  const s = modelState(health, loading);
  const modelText = s.modelTone === "allow" ? "Agent model connected" : s.modelTone === "mute" ? "Agent model status unknown" : "Agent model not ready";
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm" aria-live="polite">
      <span className="flex items-center gap-2 text-fog-dim">
        <StatusDot tone={s.lmTone} /> Model server {s.lm.toLowerCase()}
      </span>
      <span className="flex items-center gap-2 text-fog-dim">
        <StatusDot tone={s.modelTone} /> {modelText}
      </span>
    </div>
  );
}
