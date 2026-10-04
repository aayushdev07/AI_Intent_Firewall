import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { checkLMStudioConnection } from "@/lib/llm/lmstudio";
import { defaultSettings, getSettings, lmConfig } from "@/lib/services/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  let database = "healthy";
  let settings = defaultSettings();
  try {
    await prisma.$queryRaw`SELECT 1`;
    settings = await getSettings();
  } catch {
    database = "unavailable";
  }
  const lm = await checkLMStudioConnection(lmConfig(settings));
  const connected = lm.reachable && lm.modelAvailable && lm.modelLoaded !== false;
  return NextResponse.json({
    application: database === "healthy" ? "healthy" : "degraded",
    database,
    lmStudio: lm.reachable ? "connected" : "offline",
    model: lm.effectiveModel,
    configuredModel: settings.lmStudioModel,
    modelAvailable: lm.modelAvailable,
    modelLoaded: lm.modelLoaded,
    availableModels: lm.models,
    baseUrl: lm.baseUrl,
    demoMode: settings.demo.demoMode || !connected,
    demoModeForced: settings.demo.demoMode,
    error: lm.error ?? null,
  });
}
