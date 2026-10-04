import { handle } from "@/lib/api";
import { prisma } from "@/lib/db/client";
import { POLICY_DEFINITIONS } from "@/lib/firewall/policy-engine";
import { getSettings } from "@/lib/services/settings";

export const dynamic = "force-dynamic";

/** Read-only. There is intentionally no endpoint through which an agent can change policy. */
export async function GET() {
  return handle(async () => {
    const rows = await prisma.policy.findMany({ orderBy: { order: "asc" } });
    const settings = await getSettings();
    return { policies: rows.length ? rows : POLICY_DEFINITIONS, thresholds: settings.thresholds, security: settings.security };
  });
}
