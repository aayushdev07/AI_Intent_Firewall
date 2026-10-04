"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, ShieldQuestion, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { broadcastRefresh } from "@/components/layout/experience-provider";
import { api } from "@/lib/client";
import { clearSystemAlert, registerWorker, showSystemAlert, type Alert } from "@/lib/alerts-client";

const POLL_MS = 4000;
const BLOCK_TOAST_MS = 9000;
const SEEN_KEY = "ig-alerts-seen";

function isAway() {
  return document.hidden || !document.hasFocus();
}

function loadSeen(): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}
function saveSeen(s: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(s).slice(-200)));
  } catch {
    /* storage unavailable */
  }
}

/**
 * Global risk alerts. Polls the server so it works on every page:
 * - approval needed → a toast with Block / Allow once that stays until you decide;
 * - blocked → a short toast explaining what was stopped.
 * When the tab is in the background the same alert is shown as a system notification.
 */
export function AlertCenter() {
  const pathname = usePathname();
  const [pending, setPending] = useState<Alert[]>([]);
  const [blocked, setBlocked] = useState<Alert[]>([]);
  const [deciding, setDeciding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const since = useRef<string>(new Date(Date.now() - 30_000).toISOString());
  const seen = useRef<Set<string>>(new Set());
  const systemShown = useRef<Set<string>>(new Set());
  const baseTitle = useRef<string>("");

  useEffect(() => {
    seen.current = loadSeen();
    baseTitle.current = document.title;
    void registerWorker();
  }, []);

  const poll = useCallback(async () => {
    try {
      const res = await api<{ pending: Alert[]; blocked: Alert[]; serverTime: string }>(`/api/alerts?since=${encodeURIComponent(since.current)}`);
      since.current = res.serverTime;
      setPending(res.pending);
      const fresh = [...res.pending, ...res.blocked].filter((a) => !seen.current.has(a.tag));
      if (fresh.length) {
        fresh.forEach((a) => seen.current.add(a.tag));
        saveSeen(seen.current);
        const freshBlocked = res.blocked.filter((b) => fresh.includes(b));
        if (freshBlocked.length) setBlocked((prev) => [...freshBlocked, ...prev].slice(0, 3));
        broadcastRefresh();
      }
      // Being "away" includes another app in front of Chrome: the page can still be visible
      // (document.hidden === false) while the user isn't looking at it, so focus counts too.
      const away = isAway();
      for (const a of fresh) {
        if (away) {
          systemShown.current.add(a.tag);
          void showSystemAlert(a);
        } else void clearSystemAlert(a.tag);
      }
      // Approvals first seen while the user was here get a system alert once they leave.
      if (away) {
        for (const a of res.pending) {
          if (!systemShown.current.has(a.tag)) {
            systemShown.current.add(a.tag);
            void showSystemAlert(a);
          }
        }
      }
    } catch {
      /* server unavailable: try again next tick */
    }
  }, []);

  useEffect(() => {
    void poll();
    const t = setInterval(poll, POLL_MS);
    const onRefresh = () => void poll();
    const onSwMessage = (e: MessageEvent) => {
      if (e.data?.type === "ig-refresh") {
        void poll();
        broadcastRefresh();
      }
    };
    const onLeave = () => void poll();
    window.addEventListener("focus", onRefresh);
    window.addEventListener("blur", onLeave);
    document.addEventListener("visibilitychange", onLeave);
    navigator.serviceWorker?.addEventListener("message", onSwMessage);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("visibilitychange", onLeave);
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
    };
  }, [poll]);

  // Auto-dismiss block notices.
  useEffect(() => {
    if (!blocked.length) return;
    const t = setTimeout(() => setBlocked((b) => b.slice(0, -1)), BLOCK_TOAST_MS);
    return () => clearTimeout(t);
  }, [blocked]);

  // Tab title shows how many decisions are waiting.
  useEffect(() => {
    if (!baseTitle.current) return;
    document.title = pending.length ? `(${pending.length}) Approval needed · IntentGuard` : baseTitle.current;
  }, [pending.length]);

  const decide = async (a: Alert, decision: "APPROVE" | "DENY") => {
    setDeciding(a.actionId);
    setError(null);
    try {
      await api(`/api/approval/${a.actionId}`, { body: { decision } });
      setPending((p) => p.filter((x) => x.actionId !== a.actionId));
      void clearSystemAlert(a.tag);
      broadcastRefresh();
    } catch (e) {
      setError((e as Error).message);
      void poll();
    } finally {
      setDeciding(null);
    }
  };

  // The chat that owns an approval shows it inline; avoid a duplicate toast there.
  const visiblePending = pending.filter((a) => a.url !== pathname);
  const visibleBlocked = blocked.filter((a) => a.url !== pathname);
  if (!visiblePending.length && !visibleBlocked.length) return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-3 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-[380px]" aria-live="assertive">
      {visiblePending.map((a) => (
        <div key={a.tag} role="alertdialog" aria-label={a.title} className="ig-toast pointer-events-auto w-full overflow-hidden rounded-xl border border-warn/40 bg-ink-2 shadow-pop">
          <div className="flex gap-3 p-4">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-warn-bg">
              <ShieldQuestion className="size-4 text-warn" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-fog">{a.title}</p>
              <p className="mt-1 text-sm leading-snug text-fog-dim">{a.body}</p>
              {error && deciding === null ? <p className="mt-1 text-xs text-block">{error}</p> : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outlineBlock" disabled={deciding === a.actionId} onClick={() => decide(a, "DENY")}>
                  Block
                </Button>
                <Button size="sm" disabled={deciding === a.actionId} onClick={() => decide(a, "APPROVE")}>
                  Allow once
                </Button>
                <Link href={a.url} className="ml-auto text-xs text-fog-mute underline-offset-2 hover:text-fog hover:underline">
                  Open chat
                </Link>
              </div>
            </div>
          </div>
        </div>
      ))}
      {visibleBlocked.map((a) => (
        <div key={a.tag} role="status" className="ig-toast pointer-events-auto w-full rounded-xl border border-block/30 bg-ink-2 shadow-pop">
          <div className="flex gap-3 p-4">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-block-bg">
              <ShieldAlert className="size-4 text-block" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-fog">{a.title}</p>
              <p className="mt-1 text-sm leading-snug text-fog-dim">{a.body}</p>
            </div>
            <button type="button" aria-label="Dismiss" className="self-start text-fog-mute hover:text-fog" onClick={() => setBlocked((b) => b.filter((x) => x.tag !== a.tag))}>
              <X className="size-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
