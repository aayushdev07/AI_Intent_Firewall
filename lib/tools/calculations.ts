import type { SalesRecord } from "@/lib/data/fake-data";
import { latest, type ToolExecutor } from "./types";

export type SalesMetrics = {
  month: string;
  totalSales: number;
  averageSale: number;
  topProduct: string;
  monthlyRevenue: number;
  transactionCount: number;
  revenueByRegion: Record<string, number>;
};

export function computeMetrics(month: string, records: SalesRecord[]): SalesMetrics {
  const total = records.reduce((sum, r) => sum + r.revenue, 0);
  const byProduct: Record<string, number> = {};
  const byRegion: Record<string, number> = {};
  for (const r of records) {
    byProduct[r.product] = (byProduct[r.product] ?? 0) + r.revenue;
    byRegion[r.region] = (byRegion[r.region] ?? 0) + r.revenue;
  }
  const topProduct = Object.entries(byProduct).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "n/a";
  return {
    month,
    totalSales: total,
    averageSale: records.length ? Math.round(total / records.length) : 0,
    topProduct,
    monthlyRevenue: total,
    transactionCount: records.length,
    revenueByRegion: byRegion,
  };
}

/** calculate_sales — computes metrics from sales data the agent actually received. */
export const calculateSales: ToolExecutor = (_args, ctx) => {
  const sales = latest(ctx, "read_sales_database");
  if (!sales) {
    return {
      output: { error: "No sales data available. read_sales_database has not been executed in this run." },
      meta: {},
    };
  }
  const data = sales.output as { month: string; records: SalesRecord[] };
  return { output: computeMetrics(data.month, data.records), meta: { containsSensitive: false } };
};
