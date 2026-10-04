import { isoDate, parseDate, travelOptions, type TravelMode, type TravelOption } from "@/lib/data/travel";
import type { ToolContext, ToolExecutor } from "./types";

/**
 * search_trains / search_flights / book_ticket — SIMULATED travel provider.
 * Searches return deterministic fake inventory. Booking never contacts a real
 * railway or airline and never charges money; it returns a simulated PNR.
 */

function searchFor(mode: TravelMode): ToolExecutor {
  return (args) => {
    const from = typeof args.from === "string" ? args.from.trim() : "";
    const to = typeof args.to === "string" ? args.to.trim() : "";
    if (!from || !to) {
      return { output: { error: "Both 'from' and 'to' are required.", options: [] }, meta: {} };
    }
    const rawDate = typeof args.date === "string" ? args.date : "";
    const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : parseDate(rawDate) ?? isoDate(new Date(Date.now() + 86_400_000));
    const options = travelOptions(mode, from, to, date);
    return {
      output: {
        provider: "Simulated travel provider (demo data)",
        mode,
        from: options[0]?.from ?? from,
        to: options[0]?.to ?? to,
        date,
        options,
      },
      meta: {
        offers: options.map((o) => ({
          id: o.id,
          price: o.price,
          currency: o.currency,
          label: `${o.operator} ${o.number}, ${o.from} → ${o.to}, ${o.date} ${o.departs}`,
        })),
      },
    };
  };
}

export const searchTrains = searchFor("train");
export const searchFlights = searchFor("flight");

/** Finds an offer only in search results that were actually executed earlier in this run. */
export function findOffer(ctx: ToolContext, id: unknown): TravelOption | undefined {
  if (typeof id !== "string") return undefined;
  for (let i = ctx.priorResults.length - 1; i >= 0; i--) {
    const out = ctx.priorResults[i].output as { options?: TravelOption[] } | null;
    const hit = out?.options?.find((o) => o.id === id.trim());
    if (hit) return hit;
  }
  return undefined;
}

export const bookTicket: ToolExecutor = (args, ctx) => {
  const offer = findOffer(ctx, args.option_id);
  // The policy engine already blocks unverified offers; this is a second, independent check.
  if (!offer) return { output: { status: "FAILED", error: "That option was not found in this run's search results. Nothing was booked." }, meta: {} };
  const passengers = typeof args.passengers === "number" && args.passengers >= 1 ? Math.min(Math.floor(args.passengers), 6) : 1;
  const name = typeof args.passenger_name === "string" && args.passenger_name.trim() ? args.passenger_name.trim().slice(0, 60) : "Traveller";
  const pnr = `${offer.mode === "train" ? "PNR" : "BK"}${(Math.abs([...offer.id + name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % 9_000_000) + 1_000_000}`;
  return {
    output: {
      status: "CONFIRMED (SIMULATED)",
      bookingRef: pnr,
      option: offer,
      passengerName: name,
      passengers,
      totalPaid: offer.price * passengers,
      currency: offer.currency,
      note: "Simulated booking. No ticket was issued and no money was charged.",
    },
    meta: {},
  };
};
