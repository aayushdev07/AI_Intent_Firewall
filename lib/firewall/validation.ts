import type { ActionProposal, OriginalIntent, ToolMetadata } from "@/lib/types";
import { getToolMetadata } from "@/lib/tools/registry";

export type ValidationResult =
  | { ok: true; tool: ToolMetadata }
  | { ok: false; step: string; message: string; code: string };

const MAX_STRING = 2000;

/** Steps 1–4 of the evaluation order: action, tool, arguments, original intent. */
export function validateProposal(raw: unknown, intent: OriginalIntent | null | undefined): ValidationResult {
  // 1. Validate action shape
  if (!raw || typeof raw !== "object") return { ok: false, step: "Validate action", code: "MALFORMED_ACTION", message: "Proposed action is not an object." };
  const p = raw as Partial<ActionProposal>;
  if (typeof p.toolName !== "string" || !p.toolName.trim()) {
    return { ok: false, step: "Validate action", code: "MALFORMED_ACTION", message: "Proposed action has no tool name." };
  }
  if (!p.arguments || typeof p.arguments !== "object" || Array.isArray(p.arguments)) {
    return { ok: false, step: "Validate action", code: "MALFORMED_ACTION", message: "Action arguments must be a JSON object." };
  }

  // 2. Validate tool
  const tool = getToolMetadata(p.toolName);
  if (!tool) {
    return { ok: false, step: "Validate tool", code: "UNKNOWN_TOOL", message: `Unknown tool "${p.toolName}". Only registered simulated tools can be used.` };
  }

  // 3. Validate arguments (strict: unknown keys are rejected)
  const args = p.arguments as Record<string, unknown>;
  for (const key of Object.keys(args)) {
    if (!tool.params.some((param) => param.name === key)) {
      return { ok: false, step: "Validate arguments", code: "INVALID_ARGUMENTS", message: `Unexpected argument "${key}" for ${tool.name}.` };
    }
  }
  for (const param of tool.params) {
    const v = args[param.name];
    if (v === undefined || v === null || v === "") {
      if (param.required) return { ok: false, step: "Validate arguments", code: "INVALID_ARGUMENTS", message: `Missing required argument "${param.name}" for ${tool.name}.` };
      continue;
    }
    if (typeof v !== param.type) {
      return { ok: false, step: "Validate arguments", code: "INVALID_ARGUMENTS", message: `Argument "${param.name}" must be a ${param.type}.` };
    }
    if (typeof v === "string" && v.length > MAX_STRING) {
      return { ok: false, step: "Validate arguments", code: "INVALID_ARGUMENTS", message: `Argument "${param.name}" is too long.` };
    }
    if (param.enum && !param.enum.includes(String(v))) {
      return { ok: false, step: "Validate arguments", code: "INVALID_ARGUMENTS", message: `Argument "${param.name}" must be one of: ${param.enum.join(", ")}.` };
    }
  }

  // 4. Check original intent
  if (!intent) return { ok: false, step: "Check original intent", code: "NO_INTENT", message: "No confirmed Original Intent exists for this run." };
  if (intent.immutable !== true) {
    return { ok: false, step: "Check original intent", code: "INTENT_NOT_CONFIRMED", message: "The Original Intent has not been confirmed by the user." };
  }
  return { ok: true, tool };
}
