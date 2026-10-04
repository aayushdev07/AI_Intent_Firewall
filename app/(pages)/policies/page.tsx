import { PageHeader } from "@/components/layout/page-header";
import { ArchitectureDiagram } from "@/components/policies/architecture-diagram";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Tag, ToolName } from "@/components/ui/badge";
import { POLICY_DEFINITIONS } from "@/lib/firewall/policy-engine";
import { TOOL_METADATA } from "@/lib/tools/registry";
import { defaultSettings, getSettings } from "@/lib/services/settings";

export const dynamic = "force-dynamic";

const SEV: Record<string, { tone: "block" | "warn" | "neutral" | "signal"; label: string }> = {
  HARD: { tone: "block", label: "Hard: BLOCK" },
  ESCALATE: { tone: "warn", label: "Escalate: approval" },
  SOFT: { tone: "neutral", label: "Soft: raises risk" },
  INFO: { tone: "signal", label: "Baseline" },
};

export default async function PoliciesPage() {
  const settings = await getSettings().catch(() => defaultSettings());
  const { security, thresholds } = settings;
  return (
    <div className="mx-auto max-w-[1300px] space-y-6">
      <PageHeader
        title="Policies"
        description="The deterministic rules IntentGuard applies to every proposal. The worker agent can be told these rules exist, but no route lets an agent change them."
      />
      <Card>
        <CardHeader title="Security rules" description="Evaluated in order. Any hard violation blocks; an escalation requires human approval." />
        <ul className="divide-y divide-steel-line">
          {POLICY_DEFINITIONS.map((p) => {
            const downgraded =
              (p.code === "R4_UNAUTHORIZED_EXTERNAL_TRANSFER" && !security.blockUnauthorizedExternalTransfer) ||
              (p.code === "R5_SENSITIVE_EXFILTRATION" && !security.blockSensitiveExfiltration);
            return (
              <li key={p.code} className="grid gap-2 px-4 py-3 md:grid-cols-[14rem_1fr_auto] md:items-center">
                <div>
                  <div className="font-mono text-xs text-fog-mute">{p.code}</div>
                  <div className="text-sm font-medium text-fog">{p.name}</div>
                </div>
                <p className="text-sm text-fog-dim">{p.description}</p>
                <div className="flex gap-1.5">
                  {downgraded ? <Tag tone="warn">Setting: approval instead of block</Tag> : <Tag tone={SEV[p.severity].tone}>{SEV[p.severity].label}</Tag>}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Risk thresholds" description="Base bands. Higher risk tolerance in the intent shifts them up by 5 (medium) or 10 (high)." />
          <CardBody className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-allow">LOW</span><span className="font-mono text-fog">0 – {thresholds.mediumMin - 1}</span></div>
            <div className="flex justify-between"><span className="text-warn">MEDIUM</span><span className="font-mono text-fog">{thresholds.mediumMin} – {thresholds.highMin - 1}</span></div>
            <div className="flex justify-between"><span className="text-block">HIGH</span><span className="font-mono text-fog">{thresholds.highMin} – 100</span></div>
            <p className="pt-2 text-xs text-fog-mute">LOW with no violations → ALLOW. MEDIUM → WARN (human approval){security.requireApprovalForMedium ? "" : " (currently switched off in Settings: medium risk is allowed unless a rule escalates)"}. HIGH or any hard violation → BLOCK.</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Security switches" description="Changed only by a human in Settings." />
          <CardBody className="space-y-2 text-sm">
            {[
              ["Require approval for medium risk", security.requireApprovalForMedium],
              ["Block unauthorized external transfer", security.blockUnauthorizedExternalTransfer],
              ["Block sensitive data exfiltration", security.blockSensitiveExfiltration],
              ["Treat external content as untrusted", security.treatExternalContentUntrusted],
              ["Fail closed on errors", security.failClosed],
            ].map(([label, on]) => (
              <div key={label as string} className="flex justify-between gap-3">
                <span className="text-fog-dim">{label}</span>
                <span className={on ? "text-allow" : "text-warn"}>{on ? "On" : "Off"}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Simulated tools" description="All tools are simulated. No real email is sent, nothing is uploaded, and all customer data is fake." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="border-b border-steel-line text-xs text-fog-mute">
                <th className="px-4 py-2 font-medium">Tool</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Data</th>
                <th className="px-4 py-2 font-medium">External impact</th>
                <th className="px-4 py-2 font-medium">Needs explicit authorization</th>
                <th className="px-4 py-2 font-medium">Exfiltration risk</th>
                <th className="px-4 py-2 font-medium">Risk weight</th>
              </tr>
            </thead>
            <tbody>
              {TOOL_METADATA.map((t) => (
                <tr key={t.name} className="border-b border-steel-line/60">
                  <td className="px-4 py-2.5">
                    <ToolName name={t.name} />
                    <div className="text-xs text-fog-mute">{t.description}</div>
                  </td>
                  <td className="px-4 py-2.5 text-fog-dim">{t.category}</td>
                  <td className="px-4 py-2.5 text-fog-dim">{t.dataClassification}</td>
                  <td className="px-4 py-2.5 text-fog-dim">{t.externalImpact}</td>
                  <td className="px-4 py-2.5">{t.requiresExplicitAuthorization ? <Tag tone="warn">Yes</Tag> : <span className="text-fog-mute">No</span>}</td>
                  <td className="px-4 py-2.5">{t.potentialExfiltration ? <Tag tone="block">Yes</Tag> : <span className="text-fog-mute">No</span>}</td>
                  <td className="px-4 py-2.5 font-mono text-fog">{t.riskWeight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader title="Architecture" description="The LLM proposes. IntentGuard decides. Only the execution guard can reach a tool." />
        <CardBody>
          <ArchitectureDiagram />
        </CardBody>
      </Card>
    </div>
  );
}
