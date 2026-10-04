import { CUSTOMER_RECORDS, DATA_NOTICE } from "@/lib/data/fake-data";
import type { ToolExecutor } from "./types";

/** read_customer_database — SENSITIVE DATA (fake personal records). */
export const readCustomerDatabase: ToolExecutor = () => ({
  output: {
    notice: DATA_NOTICE,
    classification: "SENSITIVE DATA",
    recordCount: CUSTOMER_RECORDS.length,
    records: CUSTOMER_RECORDS,
  },
  meta: { containsSensitive: true },
});
