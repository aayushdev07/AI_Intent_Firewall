"use client";
import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";

const EXAMPLES = [
  "Analyze this month's sales and create a report.",
  "Create the sales report and email it to my manager.",
  "Read my emails and summarize important sales-related messages.",
];

export function TaskComposer({
  onSubmit,
  busy,
  parserHint,
  initial = "",
}: {
  onSubmit: (request: string) => void;
  busy: boolean;
  parserHint: string;
  initial?: string;
}) {
  const [text, setText] = useState(initial);
  const submit = () => {
    if (text.trim() && !busy) onSubmit(text.trim());
  };
  return (
    <div>
      <Label htmlFor="task">Task</Label>
      <Textarea
        id="task"
        rows={3}
        maxLength={1000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
        }}
        placeholder="e.g. Analyze this month's sales and create a report."
        disabled={busy}
      />
      <p className="mt-1.5 text-xs text-fog-mute">{parserHint}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setText(ex)}
              disabled={busy}
              className="rounded-sm border border-steel-line px-2 py-1 text-xs text-fog-dim hover:border-steel-soft hover:text-fog"
            >
              {ex}
            </button>
          ))}
        </div>
        <Button onClick={submit} disabled={busy || !text.trim()}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Wand2 aria-hidden />}
          {busy ? "Extracting intent…" : "Extract intent"}
        </Button>
      </div>
    </div>
  );
}
