"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { api } from "@/lib/client";
import { DEFAULT_EXPERIENCE, type AppSettings, type ExperienceSettings } from "@/lib/types";

type Ctx = { experience: ExperienceSettings; reload: () => Promise<void> };
const ExperienceContext = createContext<Ctx>({ experience: DEFAULT_EXPERIENCE, reload: async () => {} });

export function ExperienceProvider({ initial, children }: { initial: ExperienceSettings; children: React.ReactNode }) {
  const [experience, setExperience] = useState(initial);
  const reload = useCallback(async () => {
    try {
      const s = await api<AppSettings>("/api/settings");
      setExperience(s.experience);
    } catch {
      /* keep current */
    }
  }, []);
  return <ExperienceContext.Provider value={{ experience, reload }}>{children}</ExperienceContext.Provider>;
}

export const useExperience = () => useContext(ExperienceContext);

/** Tell every open view (sidebar, chat, alerts) to re-read server state now. */
export function broadcastRefresh() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("ig:refresh"));
}
