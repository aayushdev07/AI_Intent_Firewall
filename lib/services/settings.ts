import { prisma } from "@/lib/db/client";
import { parseJson } from "@/lib/db/json";
import { DEFAULT_EXPERIENCE, DEFAULT_SECURITY, DEFAULT_THRESHOLDS, type AppSettings, type FirewallConfig } from "@/lib/types";

const KEY = "app";

export function defaultSettings(): AppSettings {
  return {
    lmStudioBaseUrl: process.env.LM_STUDIO_BASE_URL || "http://localhost:1234/v1",
    lmStudioModel: process.env.LM_STUDIO_MODEL || "qwen3-8b",
    thresholds: { ...DEFAULT_THRESHOLDS },
    security: { ...DEFAULT_SECURITY },
    demo: { demoMode: false, promptInjectionScenario: true },
    experience: { ...DEFAULT_EXPERIENCE },
  };
}

export async function getSettings(): Promise<AppSettings> {
  const d = defaultSettings();
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  const stored = parseJson<Partial<AppSettings>>(row?.value, {});
  return {
    lmStudioBaseUrl: stored.lmStudioBaseUrl || d.lmStudioBaseUrl,
    lmStudioModel: stored.lmStudioModel || d.lmStudioModel,
    thresholds: { ...d.thresholds, ...(stored.thresholds ?? {}) },
    security: { ...d.security, ...(stored.security ?? {}) },
    demo: { ...d.demo, ...(stored.demo ?? {}) },
    experience: { ...d.experience, ...(stored.experience ?? {}) },
  };
}

export function validateSettings(s: AppSettings): string | null {
  const { mediumMin, highMin } = s.thresholds;
  if (!Number.isInteger(mediumMin) || !Number.isInteger(highMin)) return "Thresholds must be whole numbers.";
  if (mediumMin < 1 || highMin > 100 || mediumMin >= highMin) return "Thresholds must satisfy 1 ≤ medium < high ≤ 100.";
  try {
    const u = new URL(s.lmStudioBaseUrl);
    if (!/^https?:$/.test(u.protocol)) return "Model server URL must be http(s).";
    if (/(^|\.)openai\.com$/i.test(u.hostname)) return "IntentGuard connects to a local OpenAI-compatible model server, not cloud APIs.";
  } catch {
    return "Model server URL is not a valid URL.";
  }
  if (!s.lmStudioModel.trim()) return "Model identifier is required.";
  return null;
}

export async function saveSettings(next: AppSettings): Promise<AppSettings> {
  const err = validateSettings(next);
  if (err) throw new Error(err);
  await prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: JSON.stringify(next) }, update: { value: JSON.stringify(next) } });
  return next;
}

export function firewallConfig(s: AppSettings): FirewallConfig {
  return { thresholds: s.thresholds, security: s.security };
}

export function lmConfig(s: AppSettings) {
  return { baseUrl: s.lmStudioBaseUrl, model: s.lmStudioModel, apiKey: process.env.LM_STUDIO_API_KEY };
}
