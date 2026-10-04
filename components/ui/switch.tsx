"use client";
import { cn } from "@/lib/utils";

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  id,
  label,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  id?: string;
  label: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors disabled:opacity-50",
        checked ? "border-signal bg-signal" : "border-steel-soft bg-ink-3",
      )}
    >
      <span className={cn("inline-block size-3.5 rounded-full bg-white transition-transform", checked ? "translate-x-[18px]" : "translate-x-[2px]")} />
    </button>
  );
}
