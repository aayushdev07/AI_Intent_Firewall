"use client";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/badge";
import { modelState, useHealth } from "@/components/layout/health-provider";

export function ModelStatusCard() {
  const { health, loading } = useHealth();
  const s = modelState(health, loading);
  let host = "—";
  try {
    if (health) host = new URL(health.baseUrl).host;
  } catch {
    host = health?.baseUrl ?? "—";
  }
  return (
    <Card>
      <CardHeader title="Agent model" description="Any local OpenAI-compatible server. IntentGuard checks its actions; it does not trust it." />
      <CardBody>
        <div className="text-lg font-semibold text-fog">Agent model</div>
        <div className="truncate font-mono text-xs text-fog-mute" title={health?.model}>
          {health?.model ?? "—"}
          {health?.configuredModel && health.configuredModel !== health.model ? <span className="ml-1 text-fog-mute">(loaded; configured: {health.configuredModel})</span> : null}
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-fog-mute">Model server</dt>
            <dd className="flex items-center gap-2 text-fog">
              <StatusDot tone={s.lmTone} /> {s.lm}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-fog-mute">Model</dt>
            <dd className="flex items-center gap-2 text-fog">
              <StatusDot tone={s.modelTone} /> {s.model}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-fog-mute">API</dt>
            <dd className="font-mono text-fog">{host}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-fog-mute">Mode</dt>
            <dd className="text-fog">{health?.demoMode ? "Local (demo mode)" : "Local"}</dd>
          </div>
        </dl>
        {health?.error && health.lmStudio !== "connected" ? <p className="mt-3 text-xs text-fog-mute">Last check: {health.error}</p> : null}
      </CardBody>
    </Card>
  );
}
