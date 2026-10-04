import { handle } from "@/lib/api";
import { computeStats } from "@/lib/services/run-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => computeStats());
}
