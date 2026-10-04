import { prisma } from "@/lib/db/client";
import { alertFor } from "@/lib/chat-policy";

export { alertFor };

export const actionAlertInclude = {
  violations: { select: { code: true, message: true, severity: true } },
  run: { select: { intent: { select: { conversationId: true } } } },
} as const;

export async function loadAlertForAction(actionId: string) {
  const a = await prisma.action.findUnique({ where: { id: actionId }, include: actionAlertInclude });
  return a ? alertFor(a) : null;
}
