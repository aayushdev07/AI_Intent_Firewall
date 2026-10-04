import { handle } from "@/lib/api";
import { prisma } from "@/lib/db/client";
import { parseJson } from "@/lib/db/json";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { runId: string } }) {
  return handle(async () => {
    const receipts = await prisma.actionReceipt.findMany({ where: { runId: params.runId }, orderBy: { createdAt: "asc" } });
    return { receipts: receipts.map((r) => ({ ...parseJson<Record<string, unknown>>(r.payload, {}), executed: r.executed, approvalStatus: r.approvalStatus })) };
  });
}
