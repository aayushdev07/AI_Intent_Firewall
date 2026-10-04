import { PageHeader } from "@/components/layout/page-header";
import { DemoBanner } from "@/components/dashboard/demo-banner";
import { SimulationClient } from "@/components/simulation/simulation-client";
import { SCENARIOS } from "@/lib/scenarios";
import { defaultSettings, getSettings } from "@/lib/services/settings";

export const dynamic = "force-dynamic";

export default async function SimulationPage() {
  const settings = await getSettings().catch(() => defaultSettings());
  const scenarios = SCENARIOS.map((s) => ({
    id: s.id,
    number: s.number,
    title: s.title,
    userRequest: s.userRequest,
    summary: s.summary,
    expectedOutcome: s.expectedOutcome,
    agentBehaviour: s.agentBehaviour,
    script: s.script.map((p) => ({ toolName: p.toolName })),
    enabled: s.id !== "prompt-injection" || settings.demo.promptInjectionScenario,
  }));
  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        title="Simulations"
        description="Four reproducible demonstrations: an aligned agent, a drifting trajectory, a human-approval case and a prompt injection. All tools are simulated and all data is fake."
      />
      <DemoBanner />
      <SimulationClient scenarios={scenarios} />
    </div>
  );
}
