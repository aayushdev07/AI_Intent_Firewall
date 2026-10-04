import { NextResponse } from "next/server";
import { checkLMStudioConnection } from "@/lib/llm/lmstudio";
import { defaultSettings, getSettings, lmConfig } from "@/lib/services/settings";

export const dynamic = "force-dynamic";

/** Lists model identifiers from LM Studio's GET /v1/models. Optional ?baseUrl=&model= to test unsaved values. */
export async function GET(req: Request) {
  const settings = await getSettings().catch(() => defaultSettings());
  const sp = new URL(req.url).searchParams;
  const cfg = lmConfig(settings);
  const status = await checkLMStudioConnection({ ...cfg, baseUrl: sp.get("baseUrl") || cfg.baseUrl, model: sp.get("model") || cfg.model });
  return NextResponse.json(status);
}
