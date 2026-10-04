import { latest, type ToolExecutor } from "./types";

const SOURCE_TOOL: Record<string, string> = {
  sales_data: "read_sales_database",
  sales_report: "create_report",
  customer_database: "read_customer_database",
  email_summary: "read_emails",
};

/** create_file — creates a simulated local file. Tracks whether its contents are tainted. */
export const createFile: ToolExecutor = (args, ctx) => {
  const filename = String(args.filename);
  const source = String(args.content_source);
  const sourceResult = SOURCE_TOOL[source] ? latest(ctx, SOURCE_TOOL[source]) : undefined;
  const containsSensitive = Boolean(sourceResult?.meta.containsSensitive);
  const tainted = containsSensitive || Boolean(sourceResult?.meta.injectionDetected);
  const contentPreview = sourceResult
    ? JSON.stringify(sourceResult.output).slice(0, 400)
    : `[no content — ${source} was never released to the agent in this run]`;
  return {
    output: { fileId: `FILE-${Date.now().toString(36).toUpperCase()}`, filename, contentSource: source, contentPreview, simulated: true },
    meta: { containsSensitive, producedFile: { filename, tainted, sources: sourceResult ? [source] : [] } },
  };
};
