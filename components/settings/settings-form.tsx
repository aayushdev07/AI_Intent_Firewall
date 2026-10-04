"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Loader2, RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { StatusDot } from "@/components/ui/badge";
import { useHealth } from "@/components/layout/health-provider";
import { broadcastRefresh, useExperience } from "@/components/layout/experience-provider";
import { api } from "@/lib/client";
import type { AppSettings, SecuritySettings } from "@/lib/types";
import { AlertsSetting } from "./alerts-setting";

type ModelsResponse = { reachable: boolean; modelAvailable: boolean; modelLoaded: boolean | null; models: string[]; baseUrl: string; model: string; error?: string };

const SECURITY_LABELS: [keyof SecuritySettings, string, string][] = [
  ["requireApprovalForMedium", "Ask me before medium-risk steps", "Steps that are unusual for your request pause until you allow or block them."],
  ["blockUnauthorizedExternalTransfer", "Block sharing outside the app that I didn't ask for", "When off, these steps ask for your approval instead. They are never allowed silently."],
  ["blockSensitiveExfiltration", "Block sensitive data leaving the app", "When off, these steps ask for your approval instead. They are never allowed silently."],
  ["treatExternalContentUntrusted", "Treat emails and files as information only", "Instructions found inside content the assistant reads can't give it permission to do anything."],
  ["failClosed", "Block when something goes wrong", "If a check fails or errors, the step is blocked. When off, it asks for your approval instead."],
];

function Row({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-steel-line/70 py-3.5 last:border-0">
      <div>
        <p className="text-sm text-fog">{label}</p>
        {hint ? <p className="mt-0.5 max-w-lg text-xs leading-relaxed text-fog-mute">{hint}</p> : null}
      </div>
      <div className="shrink-0 pt-0.5">{children}</div>
    </div>
  );
}

export function SettingsForm({ initial }: { initial: AppSettings }) {
  const { refresh } = useHealth();
  const { reload } = useExperience();
  const [s, setS] = useState<AppSettings>(initial);
  const [saved, setSaved] = useState<AppSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [test, setTest] = useState<ModelsResponse | null>(null);
  const [testing, setTesting] = useState(false);
  const [advanced, setAdvanced] = useState(false);

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => {
    setMessage(null);
    setS((prev) => ({ ...prev, [k]: v }));
  };
  const dirty = JSON.stringify(s) !== JSON.stringify(saved);

  const testConnection = async () => {
    setTesting(true);
    try {
      const sp = new URLSearchParams({ baseUrl: s.lmStudioBaseUrl, model: s.lmStudioModel });
      setTest(await api<ModelsResponse>(`/api/models?${sp.toString()}`));
    } catch (e) {
      setTest({ reachable: false, modelAvailable: false, modelLoaded: null, models: [], baseUrl: s.lmStudioBaseUrl, model: s.lmStudioModel, error: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const next = await api<AppSettings>("/api/settings", { method: "PUT", body: s });
      setS(next);
      setSaved(next);
      setMessage({ tone: "ok", text: "Saved." });
      await Promise.all([refresh(), reload()]);
      broadcastRefresh();
    } catch (e) {
      setMessage({ tone: "error", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-24">
      <Card>
        <CardHeader title="Notifications" />
        <CardBody>
          <AlertsSetting />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Chat" />
        <CardBody className="py-1">
          <Row
            label="Always confirm my request before the assistant starts"
            hint="When off, I only ask you to confirm requests that let the assistant share something outside the app, use sensitive data, or that are unclear."
          >
            <Switch label="Always confirm" checked={s.experience.alwaysConfirm} onCheckedChange={(v) => set("experience", { ...s.experience, alwaysConfirm: v })} />
          </Row>
          <Row
            label="Show how IntentGuard works"
            hint="Adds scores and decisions to each step in chat, and unlocks the under-the-hood views: live monitor, simulations, trajectories, intents and policies."
          >
            <Switch label="Show how IntentGuard works" checked={s.experience.showWorking} onCheckedChange={(v) => set("experience", { ...s.experience, showWorking: v })} />
          </Row>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Protection" description="IntentGuard checks every step the assistant wants to take against what you asked for." />
        <CardBody className="py-1">
          {SECURITY_LABELS.map(([key, label, hint]) => (
            <Row key={key} label={label} hint={hint}>
              <Switch label={label} checked={s.security[key]} onCheckedChange={(v) => set("security", { ...s.security, [key]: v })} />
            </Row>
          ))}
        </CardBody>
      </Card>

      <section className="rounded-lg border border-steel-line bg-ink-2 shadow-card">
        <button type="button" onClick={() => setAdvanced((a) => !a)} aria-expanded={advanced} className="flex w-full items-center justify-between px-4 py-3 text-left">
          <span>
            <span className="block text-sm font-semibold text-fog">Advanced</span>
            <span className="block text-xs text-fog-mute">Agent model connection, risk thresholds, demo options</span>
          </span>
          <ChevronDown className={`size-4 text-fog-mute transition-transform ${advanced ? "rotate-180" : ""}`} aria-hidden />
        </button>
        {advanced ? (
          <div className="space-y-6 border-t border-steel-line px-4 py-4">
            <div>
              <h3 className="text-sm font-semibold text-fog">Agent model</h3>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-fog-mute">
                IntentGuard is model-agnostic: it never trusts the model, it checks what the model wants to do. The model here is only the assistant&apos;s brain.
                Point it at any local OpenAI-compatible server (LM Studio, Ollama, llama.cpp, vLLM) and any model (Qwen, Gemma, Llama, Mistral…). If the model you load differs from the name below, IntentGuard uses the loaded one automatically. Without any server, a built-in demo agent is used and the protection works the same way.
              </p>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="baseUrl">Server URL</Label>
                  <Input id="baseUrl" value={s.lmStudioBaseUrl} onChange={(e) => set("lmStudioBaseUrl", e.target.value)} placeholder="http://localhost:1234/v1" />
                </div>
                <div>
                  <Label htmlFor="model">Model</Label>
                  {test?.models.length ? (
                    <Select id="model" value={s.lmStudioModel} onChange={(e) => set("lmStudioModel", e.target.value)}>
                      {!test.models.includes(s.lmStudioModel) ? <option value={s.lmStudioModel}>{s.lmStudioModel} (not found)</option> : null}
                      {test.models.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input id="model" value={s.lmStudioModel} onChange={(e) => set("lmStudioModel", e.target.value)} placeholder="qwen3-8b" />
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <Button variant="secondary" size="sm" onClick={testConnection} disabled={testing}>
                  {testing ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />} Check connection
                </Button>
                {test ? (
                  <span className="flex items-center gap-2 text-sm text-fog-dim" aria-live="polite">
                    <StatusDot tone={test.reachable && test.modelAvailable ? "allow" : test.reachable ? "warn" : "block"} />
                    {!test.reachable ? "Server not reachable" : !test.modelAvailable ? "Server reachable, model not found" : test.modelLoaded === false ? "Model found but not loaded" : "Connected"}
                    {test.reachable && test.models.length ? <span className="text-xs text-fog-mute">({test.models.length} models available)</span> : null}
                  </span>
                ) : null}
              </div>
              <div className="mt-3">
                <Row label="Use the demo agent" hint="Ignore the model server and use the built-in demo agent. Chats say so clearly.">
                  <Switch label="Use the demo agent" checked={s.demo.demoMode} onCheckedChange={(v) => set("demo", { ...s.demo, demoMode: v })} />
                </Row>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-fog">Risk thresholds</h3>
              <p className="mt-1 text-xs text-fog-mute">Risk is scored 0–100. Medium asks for approval; high is blocked. Defaults: medium from 30, high from 70.</p>
              <div className="mt-3 grid max-w-md grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="mediumMin">Medium from</Label>
                  <Input id="mediumMin" type="number" min={1} max={99} value={s.thresholds.mediumMin} onChange={(e) => set("thresholds", { ...s.thresholds, mediumMin: Number(e.target.value) })} />
                </div>
                <div>
                  <Label htmlFor="highMin">High from</Label>
                  <Input id="highMin" type="number" min={2} max={100} value={s.thresholds.highMin} onChange={(e) => set("thresholds", { ...s.thresholds, highMin: Number(e.target.value) })} />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-fog">Demo scenarios</h3>
              <Row label="Prompt-injection scenario" hint="Scenario 4 on the Simulations page feeds the assistant an email that contains malicious instructions.">
                <Switch label="Prompt-injection scenario" checked={s.demo.promptInjectionScenario} onCheckedChange={(v) => set("demo", { ...s.demo, promptInjectionScenario: v })} />
              </Row>
              {s.experience.showWorking ? (
                <Link href="/simulation" className="text-xs text-signal hover:underline">
                  Open simulations
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-steel-line bg-ink/95 backdrop-blur md:left-[264px]">
        <div className="mx-auto flex max-w-[860px] items-center justify-end gap-4 px-4 py-3">
          {message ? (
            <span role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-sm text-block" : "text-sm text-allow"}>
              {message.text}
            </span>
          ) : dirty ? (
            <span className="text-sm text-fog-mute">Unsaved changes</span>
          ) : null}
          <Button onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />} Save
          </Button>
        </div>
      </div>
    </div>
  );
}
