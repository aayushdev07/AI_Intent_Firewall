import { getToolMetadata } from "@/lib/tools/registry";

/**
 * Deterministic helpers for reasoning about which data resources and
 * destinations an action touches, based on its arguments.
 */

export const RESOURCE_KEYWORDS: Record<string, RegExp[]> = {
  customer_database: [/customer/i, /client[\s_-]?list/i, /\bcontacts?\b/i, /\bpii\b/i, /personal data/i],
  sales_database: [/\bsales\b/i, /revenue/i, /\borders?\b/i],
  email_inbox: [/\be-?mails?\b/i, /\binbox\b/i],
};

export const SENSITIVE_RESOURCES = new Set(["customer_database"]);

/** Explicit mapping for create_file.content_source values. */
const CONTENT_SOURCE_RESOURCE: Record<string, string> = {
  customer_database: "customer_database",
  sales_data: "sales_database",
  sales_report: "sales_database",
  email_summary: "email_inbox",
};

function stringValues(args: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const v of Object.values(args)) {
    if (typeof v === "string") out.push(v);
    else if (typeof v === "number" || typeof v === "boolean") out.push(String(v));
  }
  return out;
}

/** Resources referenced by an action's arguments (e.g. a file named customer_export.csv). */
export function referencedResources(
  args: Record<string, unknown>,
  opts: { taintedFiles?: Map<string, string[]>; toolName?: string } = {},
): string[] {
  const found = new Set<string>();
  const src = args.content_source;
  if (typeof src === "string" && CONTENT_SOURCE_RESOURCE[src]) found.add(CONTENT_SOURCE_RESOURCE[src]);
  // Only data-reference arguments (filenames, sources, attachments) are scanned.
  // Free prose such as a summary or email body is never used to infer data access.
  const meta = opts.toolName ? getToolMetadata(opts.toolName) : undefined;
  const dataKeys = meta ? meta.params.filter((p) => p.dataRef).map((p) => p.name) : Object.keys(args);
  const dataArgs = Object.fromEntries(Object.entries(args).filter(([k]) => dataKeys.includes(k)));
  const text = stringValues(dataArgs).join(" \n ");
  for (const [resource, patterns] of Object.entries(RESOURCE_KEYWORDS)) {
    if (patterns.some((p) => p.test(text))) found.add(resource);
  }
  if (opts.taintedFiles) {
    for (const v of stringValues(dataArgs)) {
      const sources = opts.taintedFiles.get(v.trim().toLowerCase());
      if (sources) sources.forEach((s) => found.add(s));
    }
  }
  return Array.from(found);
}

export type DestinationMatch = "EXACT" | "AMBIGUOUS" | "MISMATCH" | "NONE";

function hostOf(value: string): string | null {
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return url.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Compare a proposed destination with the destinations the user explicitly named.
 *  EXACT      — the user named this exact address/host.
 *  AMBIGUOUS  — the user named a role/alias ("my manager") that plausibly maps to it,
 *               or allowed transfer without naming any destination. Needs a human.
 *  MISMATCH   — the user named destinations and this is none of them.
 *  NONE       — no destination argument was supplied.
 */
export function matchDestination(destination: unknown, allowed: string[] | undefined): DestinationMatch {
  if (typeof destination !== "string" || !destination.trim()) return "NONE";
  const dest = destination.trim().toLowerCase();
  const list = (allowed ?? []).map((a) => a.trim().toLowerCase()).filter(Boolean);
  if (list.length === 0) return "AMBIGUOUS";
  let ambiguous = false;
  for (const a of list) {
    const isConcrete = a.includes("@") || a.includes("://") || /\.[a-z]{2,}$/.test(a);
    if (isConcrete) {
      if (a === dest) return "EXACT";
      if (a.includes("://") || !a.includes("@")) {
        const ha = hostOf(a);
        if (ha && ha === hostOf(dest)) return "EXACT";
      }
    } else {
      const alias = a.replace(/^(my|our|the)\s+/, "").trim();
      const localPart = dest.split("@")[0];
      if (alias && (localPart.includes(alias.replace(/\s+/g, ".")) || localPart.includes(alias.replace(/\s+/g, "")) || dest.includes(alias))) {
        ambiguous = true;
      }
    }
  }
  return ambiguous ? "AMBIGUOUS" : "MISMATCH";
}

const GENERIC_TOKENS = new Set(["read", "create", "database", "external", "calculate", "the", "and", "for", "this", "that", "with", "month", "months"]);

export function keywordTokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((t) => !GENERIC_TOKENS.has(t));
}

/** Does the goal mention any meaningful token from the tool name (e.g. "sales", "report", "email")? */
export function toolMentionedInGoal(toolName: string, goal: string): boolean {
  const g = goal.toLowerCase();
  return toolName
    .split("_")
    .filter((t) => t.length >= 4 && !GENERIC_TOKENS.has(t))
    .some((t) => g.includes(t) || g.includes(t.replace(/s$/, "")));
}
