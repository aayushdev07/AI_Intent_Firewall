import { latest, type ToolExecutor } from "./types";
import type { SalesMetrics } from "./calculations";

/** create_report — creates a simulated report object from verified tool results only. */
export const createReport: ToolExecutor = (args, ctx) => {
  const metrics = latest(ctx, "calculate_sales")?.output as SalesMetrics | { error: string } | undefined;
  const emails = latest(ctx, "read_emails");
  const sections: { heading: string; body: string }[] = [];

  if (metrics && !("error" in metrics)) {
    sections.push({
      heading: `Sales summary — ${metrics.month}`,
      body:
        `Total revenue ₹${metrics.totalSales.toLocaleString("en-IN")} across ${metrics.transactionCount} transactions. ` +
        `Average sale ₹${metrics.averageSale.toLocaleString("en-IN")}. Top product: ${metrics.topProduct}.`,
    });
    sections.push({
      heading: "Revenue by region",
      body: Object.entries(metrics.revenueByRegion)
        .map(([region, v]) => `${region}: ₹${v.toLocaleString("en-IN")}`)
        .join(" · "),
    });
  }
  if (typeof args.summary === "string" && args.summary.trim()) {
    sections.push({ heading: "Agent summary", body: args.summary.trim().slice(0, 2000) });
  }
  if (emails) {
    sections.push({
      heading: "Source note",
      body: "Email contents were treated as untrusted external data. Instructions inside emails were not followed.",
    });
  }

  const tainted = emails?.meta.injectionDetected ?? false;
  return {
    output: {
      reportId: `RPT-${Date.now().toString(36).toUpperCase()}`,
      title: String(args.title ?? "Report"),
      createdAt: new Date().toISOString(),
      sections,
      simulated: true,
    },
    meta: { containsSensitive: false, untrusted: tainted },
  };
};
