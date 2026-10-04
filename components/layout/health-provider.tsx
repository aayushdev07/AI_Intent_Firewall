"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, type Health } from "@/lib/client";

type Ctx = { health: Health | null; loading: boolean; refresh: () => Promise<void> };
const HealthContext = createContext<Ctx>({ health: null, loading: true, refresh: async () => {} });

/** Polls GET /api/health so every surface shows the same, real model-server status. */
export function HealthProvider({ children }: { children: React.ReactNode }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try {
      setHealth(await api<Health>("/api/health"));
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 20_000);
    return () => clearInterval(t);
  }, [refresh]);
  return <HealthContext.Provider value={{ health, loading, refresh }}>{children}</HealthContext.Provider>;
}

export const useHealth = () => useContext(HealthContext);

export function modelState(h: Health | null, loading: boolean) {
  if (loading && !h) return { lm: "Checking…", model: "Checking…", lmTone: "mute" as const, modelTone: "mute" as const };
  if (!h) return { lm: "Server unreachable", model: "Unknown", lmTone: "block" as const, modelTone: "mute" as const };
  const lmOk = h.lmStudio === "connected";
  const ready = lmOk && h.modelAvailable && h.modelLoaded !== false;
  return {
    lm: lmOk ? "Connected" : "Offline",
    lmTone: lmOk ? ("allow" as const) : ("block" as const),
    model: ready ? (h.demoModeForced ? "Ready (demo mode on)" : "Ready") : lmOk ? (h.modelAvailable ? "Not loaded" : "Not found") : "Unavailable",
    modelTone: ready ? ("allow" as const) : lmOk ? ("warn" as const) : ("block" as const),
  };
}
