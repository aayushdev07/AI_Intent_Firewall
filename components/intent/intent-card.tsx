import { Lock, AlertTriangle } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Tag, ToolName } from "@/components/ui/badge";
import type { IntentView } from "@/components/run/types";
import { formatDateTime } from "@/lib/utils";

function List({ items, empty, tone = "neutral" }: { items: string[]; empty: string; tone?: "neutral" | "block" | "signal" }) {
  if (!items.length) return <span className="text-sm text-fog-mute">{empty}</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <Tag key={i} tone={tone}>
          <ToolName name={i} className="text-xs text-inherit" />
        </Tag>
      ))}
    </div>
  );
}

function Flag({ on, yes, no }: { on: boolean; yes: string; no: string }) {
  return <span className={on ? "text-warn" : "text-fog"}>{on ? yes : no}</span>;
}

/** The Original Intent: the user's authority boundary. Immutable once confirmed. */
export function IntentCard({ intent, footer, compact }: { intent: IntentView; footer?: React.ReactNode; compact?: boolean }) {
  const confirmed = intent.status === "CONFIRMED" && intent.immutable;
  return (
    <Card className={confirmed ? "border-signal/40" : "border-warn/40"}>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            {confirmed ? <Lock className="size-4 text-signal" aria-hidden /> : null}
            Original Intent
          </span>
        }
        description={
          confirmed
            ? `Confirmed ${formatDateTime(intent.confirmedAt)} · immutable · extracted by ${intent.parserSource === "LLM" ? "Agent model" : "rule-based parser"}`
            : `Draft extracted by ${intent.parserSource === "LLM" ? "Agent model" : "the rule-based parser"}. Review it — nothing runs until you confirm.`
        }
        action={confirmed ? <Tag tone="signal">Immutable</Tag> : <Tag tone="warn">Draft</Tag>}
      />
      <CardBody className="space-y-4">
        <div>
          <div className="text-xs text-fog-mute">User request</div>
          <p className="mt-1 text-sm text-fog-dim">“{intent.userRequest}”</p>
        </div>
        <div>
          <div className="text-xs text-fog-mute">Goal</div>
          <p className="mt-1 text-[15px] font-medium text-fog">{intent.goal}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 text-xs text-fog-mute">Allowed resources</div>
            <List items={intent.allowedResources} empty="None" />
          </div>
          <div>
            <div className="mb-1.5 text-xs text-fog-mute">Expected actions</div>
            <List items={intent.expectedActions} empty="None" tone="signal" />
          </div>
          {!compact ? (
            <div className="sm:col-span-2">
              <div className="mb-1.5 text-xs text-fog-mute">Restricted actions</div>
              <List items={intent.restrictedActions} empty="None" tone="block" />
            </div>
          ) : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-fog-mute">Sensitive data</dt>
            <dd><Flag on={intent.sensitiveDataAllowed} yes="Allowed" no="Not allowed" /></dd>
          </div>
          <div>
            <dt className="text-xs text-fog-mute">External transfer</dt>
            <dd><Flag on={intent.externalTransferAllowed} yes="Allowed" no="Not allowed" /></dd>
          </div>
          <div>
            <dt className="text-xs text-fog-mute">Risk tolerance</dt>
            <dd className="capitalize text-fog">{intent.riskTolerance}</dd>
          </div>
          <div>
            <dt className="text-xs text-fog-mute">Budget limit</dt>
            <dd className="text-fog">{intent.budgetLimit ?? "None"}</dd>
          </div>
        </dl>
        {intent.allowedDestinations.length ? (
          <div>
            <div className="mb-1.5 text-xs text-fog-mute">Destinations named by the user</div>
            <List items={intent.allowedDestinations} empty="None" />
          </div>
        ) : null}
        {intent.ambiguities.length ? (
          <div className="rounded-md border border-warn/30 bg-warn-bg p-3 text-sm">
            <p className="flex items-center gap-2 font-medium text-warn">
              <AlertTriangle className="size-4" aria-hidden /> Ambiguities (not treated as authorization)
            </p>
            <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-fog-dim">
              {intent.ambiguities.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {confirmed && intent.contentHash ? (
          <p className="break-all font-mono text-[11px] text-fog-mute" title="SHA-256 of the confirmed intent; checked before every step">
            Integrity hash {intent.contentHash}
          </p>
        ) : null}
        {footer}
      </CardBody>
    </Card>
  );
}
