import { handle } from "@/lib/api";
import { prisma } from "@/lib/db/client";
import { parseJson } from "@/lib/db/json";

export const dynamic = "force-dynamic";

/** GET /api/receipts?decision=BLOCK&level=HIGH&q=upload */
export async function GET(req: Request) {
  return handle(async () => {
    const sp = new URL(req.url).searchParams;
    const decision = sp.get("decision");
    const level = sp.get("level");
    const q = sp.get("q")?.toLowerCase();
    const rows = await prisma.actionReceipt.findMany({
      where: { ...(decision ? { decision } : {}), ...(level ? { riskLevel: level } : {}) },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { run: { select: { intent: { select: { conversationId: true } } } } },
    });
    const receipts = rows
      .map((r) => ({
        ...parseJson<Record<string, unknown>>(r.payload, {}),
        executed: r.executed,
        approvalStatus: r.approvalStatus,
        conversationId: r.run.intent.conversationId,
      }))
      .filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q));
    return { receipts };
  });
}
