import type { ToolExecutor } from "./types";
import { parseDate } from "@/lib/data/travel";

/** add_calendar_event — SIMULATED calendar. The event is recorded in this run only. */
export const addCalendarEvent: ToolExecutor = (args) => {
  const title = typeof args.title === "string" && args.title.trim() ? args.title.trim().slice(0, 120) : "Event";
  const raw = typeof args.date === "string" ? args.date : "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : parseDate(raw) ?? raw;
  const time = typeof args.time === "string" ? args.time.slice(0, 20) : null;
  return {
    output: { status: "ADDED (SIMULATED)", eventId: `EV-${Date.now().toString(36).toUpperCase()}`, title, date, time, note: "Added to the demo calendar only." },
    meta: {},
  };
};
