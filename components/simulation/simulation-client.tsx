"use client";
import { useState } from "react";
import { Bot, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tag, ToolName } from "@/components/ui/badge";
import { RunConsole } from "@/components/run/run-console";
import { useHealth } from "@/components/layout/health-provider";

export type ScenarioSummary = {
  id: string;
  number: number;
  title: string;
  userRequest: string;
  summary: string;
  expectedOutcome: string;
  agentBehaviour: string;
  script: { toolName: string }[];
  enabled: boolean;
};

export function SimulationClient({ scenarios }: { scenarios: ScenarioSummary[] }) {
  const { health } = useHealth();
  const liveAvailable = Boolean(health && !health.demoMode);
  const [selected, setSelected] = useState<string | null>(null);
  const [agent, setAgent] = useState<"scripted" | "live">("scripted");
  const [nonce, setNonce] = useState(0);
  const scenario = scenarios.find((s) => s.id === selected) ?? null;

  const pick = (id: string, a: "scripted" | "live") => {
    setSelected(id);
    setAgent(a);
    setNonce((n) => n + 1);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {scenarios.map((s) => {
          const active = s.id === selected;
          return (
            <article
              key={s.id}
              className={cn(
                "flex flex-col rounded-lg border bg-ink-2 p-4",
                active ? "border-signal" : "border-steel-line",
                !s.enabled && "opacity-60",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-fog">
                  Scenario {s.number}: {s.title}
                </h2>
                <Tag tone={s.expectedOutcome.startsWith("ALLOW") ? "allow" : s.expectedOutcome.startsWith("WARN") ? "warn" : "block"}>
                  <span className="font-mono text-[11px]">{s.expectedOutcome}</span>
                </Tag>
              </div>
              <p className="mt-2 text-sm text-fog">“{s.userRequest}”</p>
              <p className="mt-1.5 text-sm text-fog-dim">{s.summary}</p>
              <ol className="mt-3 space-y-0.5 text-xs text-fog-mute">
                {s.script.map((step, i) => (
                  <li key={i}>
                    {i + 1}. <ToolName name={step.toolName} className="text-xs text-fog-dim" />
                  </li>
                ))}
              </ol>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                {s.enabled ? (
                  <>
                    <Button size="sm" onClick={() => pick(s.id, "scripted")}>
                      <Bot aria-hidden /> Run scripted
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!liveAvailable}
                      title={liveAvailable ? "The connected agent model proposes the actions" : "Connect an agent model in Settings to enable"}
                      onClick={() => pick(s.id, "live")}
                    >
                      <Cpu aria-hidden /> Run with agent model
                    </Button>
                  </>
                ) : (
                  <p className="text-xs text-fog-mute">Disabled in Settings.</p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      <p className="text-xs text-fog-mute">
        Scripted runs replay a fixed sequence of worker-agent proposals so each scenario is reproducible. IntentGuard evaluates every proposal live
        either way. Runs with a real model depend on what the model actually proposes, so outcomes can differ from the expected ones.
      </p>

      {scenario ? (
        <section aria-label={`Scenario ${scenario.number} run`} className="space-y-3 border-t border-steel-line pt-6">
          <h2 className="text-lg font-semibold text-fog">
            Scenario {scenario.number}: {scenario.title}{" "}
            <span className="text-sm font-normal text-fog-mute">({agent === "live" ? "agent model worker" : `scripted worker, ${scenario.agentBehaviour.toLowerCase()}`})</span>
          </h2>
          <RunConsole
            key={`${scenario.id}-${agent}-${nonce}`}
            preset={{ userRequest: scenario.userRequest, scenarioId: scenario.id, agent, parser: agent === "scripted" ? "rule" : "auto" }}
          />
        </section>
      ) : (
        <p className="rounded-lg border border-dashed border-steel-line px-4 py-8 text-center text-sm text-fog-mute">
          Pick a scenario to start. You will confirm the Original Intent before the worker agent runs.
        </p>
      )}
    </div>
  );
}
