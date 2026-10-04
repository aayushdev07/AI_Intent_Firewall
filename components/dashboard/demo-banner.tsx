"use client";
import { FlaskConical } from "lucide-react";
import { useHealth } from "@/components/layout/health-provider";

/** Shown whenever proposals will not come from the real model. Never hidden. */
export function DemoBanner() {
  const { health } = useHealth();
  if (!health || !health.demoMode) return null;
  return (
    <div role="status" className="mb-5 flex items-start gap-3 rounded-lg border border-warn/40 bg-warn-bg px-4 py-3 text-sm">
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
      <div>
        <p className="font-semibold text-warn">DEMO MODE — no agent model is connected.</p>
        <p className="mt-0.5 text-fog-dim">
          {health.demoModeForced
            ? "Demo Mode is switched on in Settings."
            : `The model server ${health.lmStudio === "connected" ? `is running but model "${health.model}" is not available/loaded` : `is not reachable at ${health.baseUrl}`}.`}{" "}
          Proposals come from the built-in demo agent. Intent alignment, trajectory, risk and policy evaluation still run for real.
        </p>
      </div>
    </div>
  );
}
