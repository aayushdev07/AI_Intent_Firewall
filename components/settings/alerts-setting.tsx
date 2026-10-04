"use client";
import { useEffect, useState } from "react";
import { BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { alertSupport, disableAlerts, enableAlerts, pushSubscribed, showSystemAlert, type AlertSupport } from "@/lib/alerts-client";
import { api } from "@/lib/client";

export function AlertsSetting() {
  const [support, setSupport] = useState<AlertSupport>("default");
  const [push, setPush] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setSupport(alertSupport());
    pushSubscribed().then(setPush).catch(() => setPush(false));
  }, []);

  const enable = async () => {
    setBusy(true);
    setNote(null);
    const r = await enableAlerts();
    setSupport(alertSupport());
    setPush(r === "push");
    setNote(
      r === "push"
        ? "Alerts are on. You'll be notified even when IntentGuard isn't open, as long as your browser is running."
        : r === "local"
          ? "Alerts are on while an IntentGuard tab is open (in the background is fine). Background push couldn't be set up in this browser."
          : r === "denied"
            ? "Your browser blocked notifications. Allow them for this site in the browser's site settings, then try again."
            : "This browser doesn't support notifications.",
    );
    setBusy(false);
  };

  const disable = async () => {
    setBusy(true);
    await disableAlerts();
    setPush(false);
    setNote("Background alerts are off. You'll still see alerts inside the app.");
    setBusy(false);
  };

  const test = () =>
    showSystemAlert({
      kind: "test",
      title: "Test alert",
      body: "This is how IntentGuard will tell you about a risky action.",
      tag: `ig-test-${Date.now()}`,
      url: "/settings",
      actionId: "test",
      createdAt: new Date().toISOString(),
    });

  /** Sends a real Web Push from the server after 10 s: leave Chrome or close the tab and wait. */
  const testAway = async () => {
    setNote(null);
    try {
      await api("/api/push/test", { body: { delaySeconds: 10 } });
      setNote("Test sent in 10 seconds. Switch to another app, minimise Chrome or close this tab now, and wait for the notification.");
    } catch (e) {
      setNote((e as Error).message);
    }
  };

  const on = support === "granted";
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${on ? "bg-allow-bg" : "bg-ink-3"}`}>
          {on ? <BellRing className="size-4 text-allow" aria-hidden /> : <BellOff className="size-4 text-fog-mute" aria-hidden />}
        </span>
        <div>
          <p className="text-sm font-medium text-fog">Risk alerts</p>
          <p className="mt-0.5 max-w-md text-xs leading-relaxed text-fog-mute">
            Get a notification with <strong className="font-medium text-fog-dim">Block</strong> and <strong className="font-medium text-fog-dim">Allow once</strong> buttons
            when IntentGuard pauses a step, and a heads-up when it blocks one.
          </p>
          <p className="mt-1 text-xs text-fog-dim">
            Status:{" "}
            {support === "unsupported"
              ? "not supported in this browser"
              : support === "denied"
                ? "blocked in browser settings"
                : on
                  ? push
                    ? "on, including when the app is closed"
                    : "on while a tab is open"
                  : "off"}
          </p>
          {note ? <p className="mt-2 max-w-md text-xs text-fog-dim">{note}</p> : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {on ? (
          <>
            <Button size="sm" variant="secondary" onClick={test}>
              Test now
            </Button>
            {push ? (
              <Button size="sm" variant="secondary" onClick={testAway}>
                Test while away
              </Button>
            ) : null}
            {push ? (
              <Button size="sm" variant="ghost" onClick={disable} disabled={busy}>
                Turn off background
              </Button>
            ) : (
              <Button size="sm" onClick={enable} disabled={busy}>
                Enable background
              </Button>
            )}
          </>
        ) : (
          <Button size="sm" onClick={enable} disabled={busy || support === "unsupported"}>
            Turn on alerts
          </Button>
        )}
      </div>
    </div>
  );
}
