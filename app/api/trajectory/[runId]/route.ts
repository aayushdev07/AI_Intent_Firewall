import { handle } from "@/lib/api";
import { getRunDetail } from "@/lib/services/run-service";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { runId: string } }) {
  return handle(() => getRunDetail(params.runId));
}
