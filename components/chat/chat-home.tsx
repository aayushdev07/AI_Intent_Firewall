"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { broadcastRefresh } from "@/components/layout/experience-provider";
import { AlertsNudge } from "@/components/alerts/alerts-nudge";
import { Composer } from "./composer";
import { AssistantShell, Thinking, UserBubble } from "./turn";

const SUGGESTIONS = [
  "Find trains from Mumbai to Pune tomorrow and book the cheapest under ₹800",
  "Search flights from Delhi to Bengaluru on Friday",
  "Look up the history of the Gateway of India",
  "Analyze this month's sales and create a report.",
  "Create the sales report and email it to my manager.",
  "Read my emails and summarize important sales-related messages.",
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export function ChatHome() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async (message: string) => {
    setPending(message);
    setError(null);
    try {
      const res = await api<{ conversationId: string }>("/api/chat/send", { body: { message } });
      broadcastRefresh();
      router.push(`/chat/${res.conversationId}`);
      return true;
    } catch (e) {
      setError((e as Error).message);
      setPending(null);
      return false;
    }
  };

  if (pending) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
        <UserBubble text={pending} />
        <AssistantShell>
          <Thinking label="Understanding your request" />
        </AssistantShell>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-49px)] flex-col items-center justify-center px-4 pb-16 md:min-h-screen">
      <div className="w-full max-w-2xl">
        <h1 className="text-center font-display text-3xl font-medium tracking-tight text-fog md:text-[40px]">{greeting()}. What should I do?</h1>
        <p className="mx-auto mt-3 max-w-md text-center text-sm leading-relaxed text-fog-dim">
          I can book travel, search the web, manage your calendar and email, and work with your sales data and inbox. Every step I take is checked against what you asked for.
        </p>
        <div className="mt-8">
          <Composer onSend={send} autoFocus />
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-center text-sm text-block">
            {error}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void send(s)}
              className="rounded-full border border-steel-soft bg-ink-2 px-3.5 py-1.5 text-sm text-fog-dim transition-colors hover:border-signal/40 hover:text-fog"
            >
              {s}
            </button>
          ))}
        </div>
        <AlertsNudge />
      </div>
    </div>
  );
}
