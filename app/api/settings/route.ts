import { handle, readJson } from "@/lib/api";
import { getSettings, saveSettings } from "@/lib/services/settings";
import { ServiceError } from "@/lib/services/run-service";
import type { AppSettings } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(() => getSettings());
}

/** Operator settings (human UI only — the worker agent never receives this route or its inputs). */
export async function PUT(req: Request) {
  return handle(async () => {
    const body = (await readJson(req)) as Partial<AppSettings>;
    const current = await getSettings();
    const next: AppSettings = {
      lmStudioBaseUrl: typeof body.lmStudioBaseUrl === "string" ? body.lmStudioBaseUrl.trim() : current.lmStudioBaseUrl,
      lmStudioModel: typeof body.lmStudioModel === "string" ? body.lmStudioModel.trim() : current.lmStudioModel,
      thresholds: { ...current.thresholds, ...(body.thresholds ?? {}) },
      security: { ...current.security, ...(body.security ?? {}) },
      demo: { ...current.demo, ...(body.demo ?? {}) },
      experience: {
        showWorking: typeof body.experience?.showWorking === "boolean" ? body.experience.showWorking : current.experience.showWorking,
        alwaysConfirm: typeof body.experience?.alwaysConfirm === "boolean" ? body.experience.alwaysConfirm : current.experience.alwaysConfirm,
      },
    };
    try {
      return await saveSettings(next);
    } catch (err) {
      throw new ServiceError(err instanceof Error ? err.message : "Invalid settings.", 400, "INVALID_SETTINGS");
    }
  });
}
