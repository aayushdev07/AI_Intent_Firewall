import type { Prisma } from "@prisma/client";

export type ProvenanceInput = {
  runId: string;
  actionId?: string;
  actor: string;
  parent?: string;
  tool?: string;
  action: string;
  authoritySource: string;
};

/** Chain of authority: every event records where its authority came from. */
export async function recordProvenance(tx: Prisma.TransactionClient, e: ProvenanceInput) {
  await tx.provenanceEvent.create({ data: { ...e } });
}

export function userAuthority(intentId: string) {
  return `user-intent:${intentId}`;
}
