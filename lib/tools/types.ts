import type { ResultMeta } from "@/lib/types";

export type PriorResult = { toolName: string; output: unknown; meta: ResultMeta };

export type ToolContext = {
  runId: string;
  /** Results of actions that were actually executed earlier in this run. */
  priorResults: PriorResult[];
};

export type ToolExecutionResult = { output: unknown; meta: ResultMeta };

export type ToolExecutor = (args: Record<string, unknown>, ctx: ToolContext) => ToolExecutionResult | Promise<ToolExecutionResult>;

export function latest(ctx: ToolContext, toolName: string): PriorResult | undefined {
  for (let i = ctx.priorResults.length - 1; i >= 0; i--) {
    if (ctx.priorResults[i].toolName === toolName) return ctx.priorResults[i];
  }
  return undefined;
}
