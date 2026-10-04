"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Composer({
  onSend,
  disabled,
  busy,
  placeholder = "Ask the assistant to do something…",
  hint,
  autoFocus,
}: {
  onSend: (text: string) => Promise<boolean> | boolean;
  disabled?: boolean;
  busy?: boolean;
  placeholder?: string;
  hint?: string;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  const send = async () => {
    const t = text.trim();
    if (!t || disabled || busy) return;
    const ok = await onSend(t);
    if (ok) setText("");
  };

  return (
    <div>
      <div className={cn("flex items-end gap-2 rounded-xl border border-steel-soft bg-ink-2 p-2 shadow-card focus-within:border-signal/60", disabled && "opacity-70")}>
        <label htmlFor="composer" className="sr-only">
          Message
        </label>
        <textarea
          id="composer"
          ref={ref}
          rows={1}
          maxLength={1000}
          autoFocus={autoFocus}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={placeholder}
          className="max-h-[200px] min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-relaxed text-fog placeholder:text-fog-mute focus:outline-none disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={disabled || busy || !text.trim()}
          aria-label="Send"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-signal text-white transition-colors hover:bg-signal-dim disabled:bg-steel-soft"
        >
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowUp className="size-4" aria-hidden />}
        </button>
      </div>
      {hint ? <p className="mt-2 text-center text-[11px] text-fog-mute">{hint}</p> : null}
    </div>
  );
}
