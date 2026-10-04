import { SALES_RECORDS, DATA_NOTICE } from "@/lib/data/fake-data";
import type { ToolExecutor } from "./types";

/** read_sales_database — returns FAKE sales records (defaults to the current demo month). */
export const readSalesDatabase: ToolExecutor = (args) => {
  const month = typeof args.month === "string" && /^\d{4}-\d{2}$/.test(args.month) ? args.month : "2026-09";
  const records = SALES_RECORDS.filter((r) => r.date.startsWith(month));
  return {
    output: { notice: DATA_NOTICE, month, recordCount: records.length, records },
    meta: { containsSensitive: false },
  };
};
