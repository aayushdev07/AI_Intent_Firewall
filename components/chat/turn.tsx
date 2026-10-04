"use client";
import { useState } from "react";
import Link from "next/link";
import { Ban, Check, CircleSlash, PauseCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DecisionBadge } from "@/components/ui/badge";
import { BrandMark } from "@/components/layout/brand";
import type { ChatTurn } from "@/lib/services/chat-service";
import type { Run, RunAction } from "@/components/run/types";
import { actionLabel, attemptText, doneText, plainReason, resourceLabel } from "@/lib/plain";
import { cn } from "@/lib/utils";
import { Artifacts } from "./artifacts";

export function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-side px-4 py-2.5 text-[15px] leading-relaxed text-fog">{text}</div>
    </div>
  );
}

export function Thinking({ label = "Thinking" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-fog-mute" role="status">
      <span className="ig-dots inline-flex gap-1" aria-hidden>
        <span className="size-1.5 rounded-full bg-fog-mute" />
        <span className="size-1.5 rounded-full bg-fog-mute" />
        <span className="size-1.5 rounded-full bg-fog-mute" />
      </span>
      {label}
    </span>
  );
}

export function AssistantShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <BrandMark className="mt-0.5 size-7 shrink-0" />
      <div className="min-w-0 flex-1 space-y-3">{children}</div>
    </div>
  );
}

function ConfirmCard({ turn, onStart, onDismiss, busy, showWorking }: { turn: ChatTurn; onStart: () => void; onDismiss: () => void; busy: boolean; showWorking: boolean }) {
  const i = turn.intent;
  return (
    <div className="rounded-xl border border-steel-line bg-ink-2 p-4 shadow-card">
      <p className="text-sm text-fog-dim">Before I start, check that I&apos;ve understood you.</p>
      <p className="mt-2 text-[15px] font-medium text-fog">{i.goal}</p>
      <dl className="mt-3 space-y-2 text-sm">
        {i.expectedActions.length ? (
          <div>
            <dt className="text-xs text-fog-mute">I&apos;ll be able to</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {i.expectedActions.map((a) => (
                <span key={a} className="rounded-full bg-allow-bg px-2.5 py-0.5 text-xs text-allow">{actionLabel(a)}</span>
              ))}
              {i.allowedResources.map((r) => (
                <span key={r} className="rounded-full bg-ink-3 px-2.5 py-0.5 text-xs text-fog-dim">uses {resourceLabel(r)}</span>
              ))}
            </dd>
          </div>
        ) : null}
        {i.externalTransferAllowed ? (
          <div className="rounded-md bg-warn-bg px-3 py-2 text-warn">
            You&apos;re letting me share something outside the app{i.allowedDestinations.length ? `, only with ${i.allowedDestinations.join(", ")}` : ""}.
          </div>
        ) : null}
        {i.sensitiveDataAllowed ? <div className="rounded-md bg-warn-bg px-3 py-2 text-warn">You&apos;re letting me use sensitive data, such as customer records.</div> : null}
        {i.ambiguities.length ? (
          <div>
            <dt className="text-xs text-fog-mute">Not completely clear</dt>
            <dd>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-fog-dim">
                {i.ambiguities.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </dd>
          </div>
        ) : null}
        {i.restrictedActions.length ? (
          <div>
            <dt className="text-xs text-fog-mute">I won&apos;t</dt>
            <dd className="mt-1 flex flex-wrap gap-1.5">
              {i.restrictedActions.map((a) => (
                <span key={a} className="rounded-full bg-ink-3 px-2.5 py-0.5 text-xs text-fog-dim line-through decoration-fog-mute/60">{actionLabel(a)}</span>
              ))}
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={onStart} disabled={busy}>
          {busy ? "Starting…" : "Looks right, start"}
        </Button>
        <Button variant="ghost" onClick={onDismiss} disabled={busy}>
          That&apos;s not right
        </Button>
        {showWorking ? (
          <Link href={`/intents/${i.id}`} className="ml-auto text-xs text-fog-mute hover:text-fog">
            View Original Intent
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function StepRow({ a, showWorking, onDecide, deciding }: { a: RunAction; showWorking: boolean; onDecide: (id: string, d: "APPROVE" | "DENY") => void; deciding: string | null }) {
  const pending = a.approval?.decision === "PENDING";
  const denied = a.approval?.decision === "DENIED";
  const approved = a.approval?.decision === "APPROVED";
  const why = plainReason(a.decision, a.violations, a.alignmentScore);

  let icon = <Check className="size-3.5 text-allow" aria-hidden />;
  let text: React.ReactNode = doneText(a.toolName, a.arguments);
  let note: string | null = approved ? "You allowed this once." : null;
  if (a.decision === "BLOCK") {
    icon = <Ban className="size-3.5 text-block" aria-hidden />;
    text = <span className="text-block">Stopped: the assistant tried to {attemptText(a.toolName, a.arguments)}</span>;
    note = why;
  } else if (pending) {
    icon = <PauseCircle className="size-3.5 text-warn" aria-hidden />;
    text = <span className="text-warn">Waiting for you: {attemptText(a.toolName, a.arguments)}?</span>;
  } else if (denied) {
    icon = <CircleSlash className="size-3.5 text-fog-mute" aria-hidden />;
    text = <span className="text-fog-dim">You blocked: {attemptText(a.toolName, a.arguments)}</span>;
  } else if (a.status !== "EXECUTED") {
    icon = <CircleSlash className="size-3.5 text-fog-mute" aria-hidden />;
    text = <span className="text-fog-dim">Not carried out: {attemptText(a.toolName, a.arguments)}</span>;
  }

  return (
    <li className="ig-enter">
      <div className="flex items-start gap-2.5">
        <span className="mt-[3px] flex size-5 shrink-0 items-center justify-center rounded-full bg-ink-3">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-fog">{text}</p>
          {note ? <p className="mt-0.5 text-xs leading-snug text-fog-mute">{note}</p> : null}
          {showWorking ? (
            <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-fog-mute">
              <DecisionBadge decision={a.decision} />
              <span>{a.toolName}</span>
              <span>alignment {Math.round(a.alignmentScore ?? 0)}%</span>
              <span>risk {Math.round(a.riskScore ?? 0)} {a.riskLevel}</span>
              {a.violations.map((v) => (
                <span key={v.code}>{v.code.split("_")[0]}</span>
              ))}
            </p>
          ) : null}
        </div>
      </div>
      {pending ? (
        <div className="ml-7 mt-2 rounded-xl border border-warn/40 bg-warn-bg/60 p-3.5">
          <p className="text-sm font-medium text-fog">IntentGuard paused this step.</p>
          <p className="mt-0.5 text-sm text-fog-dim">{why}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outlineBlock" disabled={deciding === a.id} onClick={() => onDecide(a.id, "DENY")}>
              Block
            </Button>
            <Button size="sm" disabled={deciding === a.id} onClick={() => onDecide(a.id, "APPROVE")}>
              Allow once
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-fog-mute">Allowing applies to this one step only. If you don&apos;t answer within 15 minutes, it&apos;s blocked.</p>
        </div>
      ) : null}
    </li>
  );
}

const GENERIC_NOTES = /^(Scenario script finished|Demo worker finished|Step limit)/;

function replyText(run: Run): string | null {
  if (run.status === "RUNNING" || run.status === "WAITING_APPROVAL") return null;
  const executed = run.actions.filter((a) => a.status === "EXECUTED");
  const blocked = run.actions.filter((a) => a.decision === "BLOCK");
  const denied = run.actions.filter((a) => a.approval?.decision === "DENIED");
  if (run.status === "FAILED") return run.lastAgentNote ? `I had to stop. ${run.lastAgentNote}` : "Something went wrong, so I stopped. Nothing else was carried out.";
  if (run.status === "HALTED") return "I stopped working on this because the assistant kept trying things you didn't ask for. None of those were carried out.";
  const parts: string[] = [];
  const note = run.lastAgentNote?.trim();
  if (run.mode === "LIVE" && note && !GENERIC_NOTES.test(note)) parts.push(note);
  else if (!executed.length && !blocked.length && !denied.length)
    parts.push("I couldn't find a step I can take for that. I can search and book trains and flights, search the web, add calendar events, send email, and work with your sales data, inbox and reports.");
  else if (executed.length) parts.push(blocked.length || denied.length ? "Done, with some steps left out." : "Done. Here's the result.");
  if (blocked.length) parts.push(`IntentGuard stopped ${blocked.length === 1 ? "one step" : `${blocked.length} steps`} that didn't match what you asked for.`);
  if (denied.length) parts.push(`I skipped ${denied.length === 1 ? "the step" : "the steps"} you blocked.`);
  return parts.join(" ");
}

export function AssistantTurn({
  turn,
  showWorking,
  onStart,
  onDecide,
  deciding,
  starting,
}: {
  turn: ChatTurn;
  showWorking: boolean;
  onStart: (intentId: string) => void;
  onDecide: (actionId: string, d: "APPROVE" | "DENY") => void;
  deciding: string | null;
  starting: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  const run = turn.run;

  if (turn.reply) {
    return (
      <AssistantShell>
        <p className="whitespace-pre-line text-[15px] leading-relaxed text-fog">{turn.reply}</p>
      </AssistantShell>
    );
  }

  if (!run) {
    if (turn.needsConfirmation) {
      if (dismissed) return <AssistantShell><p className="text-sm text-fog-dim">No problem. Tell me what you&apos;d like instead and I&apos;ll start over.</p></AssistantShell>;
      return (
        <AssistantShell>
          <ConfirmCard turn={turn} onStart={() => onStart(turn.intent.id)} onDismiss={() => setDismissed(true)} busy={starting} showWorking={showWorking} />
        </AssistantShell>
      );
    }
    return (
      <AssistantShell>
        <Thinking label="Starting" />
      </AssistantShell>
    );
  }

  const active = run.status === "RUNNING";
  const reply = replyText(run);
  return (
    <AssistantShell>
      {run.actions.length ? (
        <ol className={cn("space-y-2.5", !reply && "pb-1")}>
          {run.actions.map((a) => (
            <StepRow key={a.id} a={a} showWorking={showWorking} onDecide={onDecide} deciding={deciding} />
          ))}
        </ol>
      ) : null}
      {active ? <Thinking label={run.actions.length ? "Working" : "Thinking"} /> : null}
      {reply ? <p className="whitespace-pre-line text-[15px] leading-relaxed text-fog">{reply}</p> : null}
      {!active ? <Artifacts actions={run.actions} /> : null}
      {!active && run.trajectory.untrustedInstructionsDetected ? (
        <p className="flex items-center gap-1.5 text-xs text-fog-mute">
          <ShieldCheck className="size-3.5 text-signal" aria-hidden />
          Content the assistant reads can inform it, but it can&apos;t give it new permissions.
        </p>
      ) : null}
      {showWorking ? (
        <p className="text-xs">
          <Link href={`/trajectories/${run.id}`} className="text-signal hover:underline">
            Open full trajectory
          </Link>
          <span className="text-fog-mute"> · run {run.id.slice(-8)} · {run.mode.toLowerCase()} agent</span>
        </p>
      ) : null}
    </AssistantShell>
  );
}
