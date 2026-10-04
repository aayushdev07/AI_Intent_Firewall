import { NextResponse } from "next/server";
import { handle, readJson, str } from "@/lib/api";
import { executeAction } from "@/lib/services/run-service";

export const dynamic = "force-dynamic";

/**
 * POST { actionId } — independently re-verifies the stored decision, approval and
 * integrity hash. Never trusts the frontend: BLOCKed or un-approved actions get 403.
 */
export async function POST(req: Request) {
  const res = await handle(async () => {
    const body = await readJson(req);
    return executeAction(str(body.actionId, "actionId"));
  });
  if (!res.ok) return res;
  const data = await res.json();
  return NextResponse.json(data, { status: data.executed === false ? 403 : 200 });
}
