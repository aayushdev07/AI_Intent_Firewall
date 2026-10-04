"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/client";
import type { ConversationDetail } from "@/lib/services/chat-service";
import { broadcastRefresh, useExperience } from "@/components/layout/experience-provider";
import { Composer } from "./composer";
import { AssistantShell, AssistantTurn, Thinking, UserBubble } from "./turn";

const ACTIVE_POLL_MS = 1200;

export function ChatThread({ id }: { id: string }) {
  const router = useRouter();
  const { experience } = useExperience();
  const [convo, setConvo] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [deciding, setDeciding] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const lastSize = useRef(0);

  const load = useCallback(async () => {
    try {
      setConvo(await api<ConversationDetail>(`/api/conversations/${id}`));
      setOffline(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) router.replace("/chat");
      // The dev server restarting or a brief network drop: keep polling and say so quietly.
      else if (e instanceof ApiError && e.code === "NETWORK") setOffline(true);
      else setError((e as Error).message);
    }
  }, [id, router]);

  useEffect(() => {
    void load();
    const onRefresh = () => void load();
    window.addEventListener("ig:refresh", onRefresh);
    window.addEventListener("focus", onRefresh);
    return () => {
      window.removeEventListener("ig:refresh", onRefresh);
      window.removeEventListener("focus", onRefresh);
    };
  }, [load]);

  // Poll while the agent is working or waiting (approvals can also arrive from a notification).
  const waitingStart = convo?.turns.some((t) => !t.reply && !t.run && !t.needsConfirmation);
  const active = convo?.status === "running" || convo?.status === "waiting" || waitingStart || offline;
  useEffect(() => {
    if (!active) return;
    const t = setInterval(load, ACTIVE_POLL_MS);
    return () => clearInterval(t);
  }, [active, load]);

  // Keep the newest content in view.
  const size = (convo?.turns.reduce((n, t) => n + 1 + (t.run?.actions.length ?? 0) + (t.run?.status === "RUNNING" ? 0 : 1), 0) ?? 0) + (sending ? 1 : 0);
  useEffect(() => {
    if (size !== lastSize.current) {
      lastSize.current = size;
      bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [size]);

  const send = async (message: string) => {
    setSending(message);
    setError(null);
    try {
      await api("/api/chat/send", { body: { conversationId: id, message } });
      await load();
      broadcastRefresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setSending(null);
    }
  };

  const start = async (intentId: string) => {
    setStarting(true);
    setError(null);
    try {
      await api("/api/chat/start", { body: { intentId } });
      await load();
      broadcastRefresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const decide = async (actionId: string, decision: "APPROVE" | "DENY") => {
    setDeciding(actionId);
    setError(null);
    try {
      await api(`/api/approval/${actionId}`, { body: { decision } });
      await load();
      broadcastRefresh();
    } catch (e) {
      setError((e as Error).message);
      await load();
    } finally {
      setDeciding(null);
    }
  };

  const busy = convo?.status !== "idle" || Boolean(sending);
  const lastTurn = convo?.turns.at(-1);
  const awaitingConfirm = Boolean(lastTurn && !lastTurn.run && lastTurn.needsConfirmation);

  return (
    <div className="flex min-h-[calc(100vh-49px)] flex-col md:min-h-screen">
      <div className="flex-1">
        <div className="mx-auto w-full max-w-3xl space-y-7 px-4 pb-8 pt-8">
          {!convo ? (
            <AssistantShell>
              <Thinking label="Loading chat" />
            </AssistantShell>
          ) : (
            convo.turns.map((t) => (
              <div key={t.intent.id} className="space-y-4">
                <UserBubble text={t.intent.userRequest} />
                <AssistantTurn turn={t} showWorking={experience.showWorking} onStart={start} onDecide={decide} deciding={deciding} starting={starting} />
              </div>
            ))
          )}
          {sending ? (
            <div className="space-y-4">
              <UserBubble text={sending} />
              <AssistantShell>
                <Thinking label="Understanding your request" />
              </AssistantShell>
            </div>
          ) : null}
          <div ref={bottom} />
        </div>
      </div>
      <div className="sticky bottom-0 bg-gradient-to-t from-ink via-ink to-ink/0 px-4 pb-4 pt-6">
        <div className="mx-auto w-full max-w-3xl">
          {offline ? (
            <p role="status" className="mb-2 text-center text-sm text-fog-mute">
              Reconnecting to IntentGuard… Make sure <code className="font-mono text-xs">npm run dev</code> is still running.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="mb-2 text-center text-sm text-block">
              {error}
            </p>
          ) : null}
          <Composer
            onSend={send}
            busy={Boolean(sending)}
            disabled={busy && !awaitingConfirm}
            placeholder={convo?.status === "waiting" ? "Waiting for your decision above…" : busy && !awaitingConfirm ? "The assistant is working…" : "Message the assistant…"}
            hint="Every action is checked by IntentGuard. Bookings and business data are simulated; web search is live."
          />
        </div>
      </div>
    </div>
  );
}
