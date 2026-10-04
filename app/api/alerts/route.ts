import { handle } from "@/lib/api";
import { listAlerts } from "@/lib/services/chat-service";

export const dynamic = "force-dynamic";

/** GET ?since=ISO — pending approvals and blocks since the given time, in plain language. */
export async function GET(req: Request) {
  return handle(() => listAlerts(new URL(req.url).searchParams.get("since")));
}
