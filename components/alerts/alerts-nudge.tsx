"use client";
import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { alertSupport, enableAlerts } from "@/lib/alerts-client";

const KEY = "ig-alerts-nudge-dismissed";

/** One-time suggestion to turn on risk alerts, shown only while permission hasn't been asked. */
export function AlertsNudge() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(KEY) === "1";
    } catch {
      /* ignore */
    }
    setShow(!dismissed && alertSupport() === "default");
  }, []);
  if (!show) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  };
  return (
    <div className="mx-auto mt-8 flex max-w-md items-center gap-3 rounded-xl border border-steel-line bg-ink-2 px-4 py-3 text-sm shadow-card">
      <BellRing className="size-4 shrink-0 text-clay" aria-hidden />
      <p className="text-fog-dim">Get a notification when a step needs your OK, even if you&apos;re in another tab.</p>
      <button
        type="button"
        className="shrink-0 font-medium text-signal hover:underline"
        onClick={async () => {
          await enableAlerts();
          dismiss();
        }}
      >
        Turn on
      </button>
      <button type="button" aria-label="Dismiss" className="shrink-0 text-fog-mute hover:text-fog" onClick={dismiss}>
        <X className="size-4" />
      </button>
    </div>
  );
}
