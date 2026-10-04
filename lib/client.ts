/** Browser-side fetch helper. All security decisions stay on the server; this only transports them. */
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

export async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: init?.method ?? (init?.body ? "POST" : "GET"),
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Cannot reach the IntentGuard server.", 0, "NETWORK");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.error ?? `Request failed (HTTP ${res.status}).`, res.status, data?.code);
  return data as T;
}

export type Health = {
  application: "healthy" | "degraded";
  database: "healthy" | "unavailable";
  lmStudio: "connected" | "offline";
  model: string;
  configuredModel?: string;
  modelAvailable: boolean;
  modelLoaded: boolean | null;
  availableModels: string[];
  baseUrl: string;
  demoMode: boolean;
  demoModeForced: boolean;
  error: string | null;
};

export type Stats = {
  activeRuns: number;
  totalRuns: number;
  actionsEvaluated: number;
  actionsAllowed: number;
  warnings: number;
  blocked: number;
  averageAlignment: number | null;
  highestRisk: number | null;
};
