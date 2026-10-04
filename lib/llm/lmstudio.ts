import OpenAI from "openai";

/**
 * Model service — talks to any local OpenAI-compatible server (LM Studio, Ollama,
 * llama.cpp, vLLM). It is deliberately model-agnostic: it never assumes Qwen-only
 * features. JSON output and tool-calling both degrade gracefully for models such as
 * Gemma, Llama or Mistral that don't support strict schemas or the tools API.
 */

export type LMStudioConfig = { baseUrl: string; model: string; apiKey?: string };

export type LMStudioStatus = {
  reachable: boolean;
  modelAvailable: boolean;
  /** true/false when the server reports load state, null when it cannot be determined. */
  modelLoaded: boolean | null;
  models: string[];
  baseUrl: string;
  model: string;
  /** The model id the app will actually use (the configured one, or the only/first loaded one). */
  effectiveModel: string;
  error?: string;
};

export function createClient(cfg: LMStudioConfig) {
  return new OpenAI({ baseURL: cfg.baseUrl, apiKey: cfg.apiKey || process.env.LM_STUDIO_API_KEY || "lm-studio", timeout: 180_000, maxRetries: 0 });
}

async function fetchJson(url: string, timeoutMs: number): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/**
 * Resolve which model to use. If the configured id isn't among the loaded models but
 * exactly one model IS loaded, use that one — so "Gemma is loaded but .env still says
 * qwen3-8b" just works instead of silently dropping to demo mode.
 */
export function resolveModel(configured: string, loaded: string[]): string {
  if (loaded.includes(configured)) return configured;
  if (loaded.length === 1) return loaded[0];
  // Prefer a loaded id that looks like the configured one (e.g. "gemma-3-4b" vs "gemma-3-4b-it").
  const want = configured.toLowerCase();
  const near = loaded.find((m) => m.toLowerCase().includes(want) || want.includes(m.toLowerCase()));
  return near ?? configured;
}

/** Verifies: server reachable? which models are loaded? which one will we use? */
export async function checkLMStudioConnection(cfg: LMStudioConfig): Promise<LMStudioStatus> {
  const base = cfg.baseUrl.replace(/\/+$/, "");
  const status: LMStudioStatus = {
    reachable: false,
    modelAvailable: false,
    modelLoaded: null,
    models: [],
    baseUrl: base,
    model: cfg.model,
    effectiveModel: cfg.model,
  };
  try {
    const data = (await fetchJson(`${base}/models`, 3000)) as { data?: { id: string }[] };
    status.reachable = true;
    // /v1/models on LM Studio lists LOADED models. On some servers it lists all; the native check below refines it.
    status.models = (data.data ?? []).map((m) => m.id).filter(Boolean);
  } catch (err) {
    status.error = err instanceof Error ? (err.name === "AbortError" ? "Connection timed out" : err.message) : "Unreachable";
    return status;
  }

  // LM Studio's native REST API (/api/v0/models) reports per-model load state when available.
  let loadedIds: string[] | null = null;
  try {
    const origin = new URL(base).origin;
    const native = (await fetchJson(`${origin}/api/v0/models`, 2500)) as { data?: { id: string; state?: string }[] };
    const entries = native.data ?? [];
    const loaded = entries.filter((m) => m.state === "loaded").map((m) => m.id);
    if (entries.length) loadedIds = loaded;
  } catch {
    /* native API not present (Ollama/llama.cpp/vLLM): treat /v1/models as the loaded list */
  }

  // The usable set of models: those the native API says are loaded, else whatever /v1/models returned.
  const usable = loadedIds ?? status.models;
  status.models = usable.length ? usable : status.models;
  status.effectiveModel = resolveModel(cfg.model, usable);
  status.modelAvailable = usable.length > 0;
  // "Loaded" is true if we have at least one usable model to talk to.
  status.modelLoaded = usable.length > 0 ? true : loadedIds !== null ? false : null;
  return status;
}

/** Many local models emit <think>…</think> (Qwen) or similar; never treat them as output. */
export function stripThinking(text: string | null | undefined): string {
  return (text ?? "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<\|?thinking\|?>[\s\S]*?<\/?\|?thinking\|?>/gi, "")
    .trim();
}

export function extractJsonObject(text: string): unknown {
  const clean = stripThinking(text)
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(clean);
  } catch {
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(clean.slice(start, end + 1));
      } catch {
        /* fall through */
      }
    }
    throw new Error("Model did not return valid JSON.");
  }
}

/**
 * Structured JSON output that works across models.
 * 1) try strict json_schema (Qwen, newer LM Studio builds),
 * 2) fall back to json_object mode,
 * 3) fall back to plain prompting — then parse the JSON out of the text.
 * The caller validates the shape with zod, so a loose model still produces a safe result or a clean error.
 */
export async function chatJson(cfg: LMStudioConfig, system: string, user: string, schemaName: string, schema: Record<string, unknown>) {
  const client = createClient(cfg);
  const messages = [
    { role: "system" as const, content: `${system}\n\nReturn ONLY a single JSON object. No prose, no markdown fences.` },
    { role: "user" as const, content: user },
  ];

  const attempts: (() => Promise<string>)[] = [
    async () => {
      const c = await client.chat.completions.create({
        model: cfg.model,
        temperature: 0.1,
        messages,
        response_format: { type: "json_schema", json_schema: { name: schemaName, strict: true, schema } } as never,
      });
      return c.choices[0]?.message?.content ?? "";
    },
    async () => {
      const c = await client.chat.completions.create({
        model: cfg.model,
        temperature: 0.1,
        messages,
        response_format: { type: "json_object" } as never,
      });
      return c.choices[0]?.message?.content ?? "";
    },
    async () => {
      const c = await client.chat.completions.create({ model: cfg.model, temperature: 0.1, messages });
      return c.choices[0]?.message?.content ?? "";
    },
  ];

  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      const raw = await attempt();
      return extractJsonObject(raw);
    } catch (err) {
      lastErr = err;
      // A 400 usually means the server rejected that response_format: try the next, simpler mode.
      // Any other error also falls through to the next attempt.
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("The model did not return usable JSON.");
}
