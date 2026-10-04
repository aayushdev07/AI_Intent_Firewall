"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Plus, ShieldCheck } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TaskComposer } from "@/components/intent/task-composer";
import { IntentCard } from "@/components/intent/intent-card";
import { useHealth } from "@/components/layout/health-provider";
import { api, ApiError } from "@/lib/client";
import type { LivePhase } from "@/components/agent/agent-status";
import type { IntentView, RunDetail } from "./types";
import { RunView } from "./run-view";

/** Pause between steps so each proposal → evaluation → decision is visible. */
const STEP_DELAY_MS = 1100;

export type RunPreset = {
  userRequest: string;
  scenarioId?: string;
  agent?: "scripted" | "live" | "auto";
  parser?: "auto" | "rule";
};

type Stage = "compose" | "review" | "run";

/**
 * Client state machine for one agent run:
 * compose → extract intent → review/confirm (immutable) → start → step loop → done.
 * All decisions come from the server; this component only displays and relays.
 */
export function RunConsole({
  initialRunId,
  preset,
  onActivity,
  syncUrl = false,
}: {
  initialRunId?: string;
  preset?: RunPreset;
  onActivity?: () => void;
  syncUrl?: boolean;
}) {
  const { health } = useHealth();
  const [stage, setStage] = useState<Stage>(initialRunId ? "run" : "compose");
  const [intent, setIntent] = useState<IntentView | null>(null);
  const [run, setRun] = useState<RunDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<LivePhase>("idle");
  const [autoRun, setAutoRun] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const presetDone = useRef(false);

  const fail = (err: unknown) => {
    setError(err instanceof ApiError || err instanceof Error ? err.message : "Unexpected error.");
    setAutoRun(false);
  };

  const setUrl = useCallback(
    (runId: string | null) => {
      if (!syncUrl || typeof window === "undefined") return;
      const url = new URL(window.location.href);
      if (runId) {
        url.searchParams.set("run", runId);
        url.searchParams.delete("new");
      } else {
        url.searchParams.delete("run");
        url.searchParams.set("new", "1");
      }
      window.history.replaceState(null, "", url.toString());
    },
    [syncUrl],
  );

  // Load an existing run (e.g. /dashboard?run=…). Never auto-resumes: the user decides.
  useEffect(() => {
    if (!initialRunId) return;
    let cancelled = false;
    api<RunDetail>(`/api/trajectory/${initialRunId}`)
      .then((r) => {
        if (cancelled) return;
        setRun(r);
        setIntent(r.intent);
        setStage("run");
      })
      .catch((e) => {
        if (cancelled) return;
        fail(e);
        setStage("compose");
      });
    return () => {
      cancelled = true;
    };
  }, [initialRunId]);

  const extract = useCallback(
    async (userRequest: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      try {
        const res = await api<{ intent: IntentView }>("/api/intent/extract", { body: { userRequest, parser: preset?.parser ?? "auto" } });
        setIntent(res.intent);
        setStage("review");
      } catch (e) {
        fail(e);
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [preset?.parser],
  );

  // Scenarios extract their fixed request immediately; the user still reviews and confirms.
  useEffect(() => {
    if (preset && !initialRunId && !presetDone.current) {
      presetDone.current = true;
      void extract(preset.userRequest);
    }
  }, [preset, initialRunId, extract]);

  const confirmAndStart = async () => {
    if (!intent || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const confirmed = await api<{ intent: IntentView }>("/api/intent/confirm", { body: { intentId: intent.id } });
      setIntent(confirmed.intent);
      const started = await api<{ runId: string }>("/api/agent/start", {
        body: { intentId: confirmed.intent.id, scenarioId: preset?.scenarioId, agent: preset?.agent ?? "auto" },
      });
      const detail = await api<RunDetail>(`/api/trajectory/${started.runId}`);
      setRun(detail);
      setStage("run");
      setUrl(started.runId);
      setAutoRun(true);
      onActivity?.();
    } catch (e) {
      fail(e);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const step = useCallback(async () => {
    if (!run || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setPhase("proposing");
    const t = setTimeout(() => setPhase("evaluating"), 500);
    const started = Date.now();
    try {
      const res = await api<{ run: RunDetail }>("/api/agent/step", { body: { runId: run.id } });
      const wait = 900 - (Date.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      setRun(res.run);
      onActivity?.();
    } catch (e) {
      fail(e);
    } finally {
      clearTimeout(t);
      setPhase("idle");
      inFlight.current = false;
      setBusy(false);
    }
  }, [run, onActivity]);

  // Step loop. The effect is re-armed after each state change; the ref guard makes it safe under StrictMode.
  useEffect(() => {
    if (!autoRun || !run || run.status !== "RUNNING" || busy) return;
    const t = setTimeout(() => void step(), STEP_DELAY_MS);
    return () => clearTimeout(t);
  }, [autoRun, run, busy, step]);

  const decide = async (actionId: string, decision: "APPROVE" | "DENY") => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ run: RunDetail | null }>(`/api/approval/${actionId}`, { body: { decision } });
      if (res.run) setRun(res.run);
      setAutoRun(true);
      onActivity?.();
    } catch (e) {
      fail(e);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  const reset = () => {
    setStage("compose");
    setIntent(null);
    setRun(null);
    setError(null);
    setAutoRun(false);
    setUrl(null);
  };

  const parserHint =
    preset?.parser === "rule"
      ? "Intent is extracted by the deterministic rule-based parser for this scenario."
      : health && !health.demoMode
        ? "The agent model extracts the intent. You review it before anything runs."
        : "No agent model is connected: the rule-based parser extracts the intent.";

  const errorBox = error ? (
    <div role="alert" className="rounded-md border border-block/40 bg-block-bg px-4 py-3 text-sm text-fog">
      <span className="font-semibold text-block">Could not continue. </span>
      {error}
    </div>
  ) : null;

  if (stage === "run" && run) {
    const active = run.status === "RUNNING";
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-fog-dim">
            <ShieldCheck className="size-4 text-signal" aria-hidden />
            Worker agent proposes. IntentGuard decides. Only permitted actions execute.
          </div>
          <div className="flex gap-2">
            {active ? (
              autoRun ? (
                <Button variant="secondary" size="sm" onClick={() => setAutoRun(false)}>
                  <Pause /> Pause
                </Button>
              ) : (
                <Button size="sm" onClick={() => setAutoRun(true)} disabled={busy}>
                  <Play /> {run.actions.length ? "Resume" : "Run agent"}
                </Button>
              )
            ) : null}
            {active && !autoRun ? (
              <Button variant="secondary" size="sm" onClick={() => void step()} disabled={busy}>
                Single step
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={reset} disabled={busy && phase !== "idle"}>
              <Plus /> New task
            </Button>
          </div>
        </div>
        {errorBox}
        <RunView run={run} phase={phase} onDecide={decide} deciding={busy} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {errorBox}
      {stage === "review" && intent ? (
        <IntentCard
          intent={intent}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-steel-line pt-4">
              <p className="max-w-lg text-xs text-fog-mute">
                Confirming locks this intent. The agent, tool outputs and external content cannot change it for the rest of the run.
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={reset} disabled={busy}>
                  Edit task
                </Button>
                <Button onClick={confirmAndStart} disabled={busy}>
                  <ShieldCheck /> {busy ? "Starting…" : "Confirm intent and start agent"}
                </Button>
              </div>
            </div>
          }
        />
      ) : stage === "compose" ? (
        <Card>
          <CardHeader title="New agent task" description="Describe the task. IntentGuard turns it into an Original Intent you confirm before the agent starts." />
          <CardBody>
            <TaskComposer onSubmit={extract} busy={busy} parserHint={parserHint} initial={preset?.userRequest ?? ""} />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="text-sm text-fog-dim">{busy ? "Extracting intent…" : "Loading run…"}</CardBody>
        </Card>
      )}
    </div>
  );
}
