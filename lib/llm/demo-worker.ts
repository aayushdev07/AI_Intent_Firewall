import type { ActionProposal, OriginalIntent } from "@/lib/types";
import { CONTACTS } from "@/lib/data/fake-data";
import { isoDate, parseDate, parseRoute, type TravelOption } from "@/lib/data/travel";
import type { PriorResult } from "@/lib/tools/types";

/**
 * DEMO MODE worker — used ONLY when no agent model is connected.
 * It deterministically proposes the intent's expected actions in order, filling arguments
 * from the user's words and from verified results of earlier steps.
 * Its proposals are labelled DEMO everywhere and are never shown as model output.
 */
function latestOutput<T>(prior: PriorResult[], tools: string[]): T | undefined {
  for (let i = prior.length - 1; i >= 0; i--) if (tools.includes(prior[i].toolName)) return prior[i].output as T;
  return undefined;
}

function travelArgs(text: string) {
  const { from, to } = parseRoute(text);
  return { from: from ?? "Mumbai", to: to ?? "Pune", date: parseDate(text) ?? isoDate(new Date(Date.now() + 86_400_000)) };
}

export function demoNextAction(intent: OriginalIntent, proposedTools: string[], prior: PriorResult[] = []): ActionProposal | null {
  const next = intent.expectedActions.find((a) => !proposedTools.includes(a));
  if (!next) return null;
  const reason = `Demo worker: "${next}" is the next expected step for the goal.`;
  const request = intent.goal;
  switch (next) {
    case "read_sales_database":
      return { toolName: next, arguments: { month: "2026-09" }, reason };
    case "read_emails":
      return { toolName: next, arguments: { limit: 10 }, reason };
    case "create_report":
      return { toolName: next, arguments: { title: intent.goal.slice(0, 80) }, reason };
    case "create_file":
      return { toolName: next, arguments: { filename: "report.txt", content_source: "sales_report" }, reason };
    case "send_email": {
      const dest = intent.allowedDestinations?.[0] ?? "";
      const alias = dest.replace(/^(my|our|the)\s+/i, "").trim().toLowerCase();
      const to = dest.includes("@") ? dest : CONTACTS[alias] ?? `${alias || "recipient"}@example.com`;
      const booking = latestOutput<{ bookingRef?: string; option?: TravelOption }>(prior, ["book_ticket"]);
      const body = booking?.bookingRef
        ? `Booking ${booking.bookingRef}: ${booking.option?.operator} ${booking.option?.number}, ${booking.option?.from} to ${booking.option?.to} on ${booking.option?.date} at ${booking.option?.departs}.`
        : undefined;
      return { toolName: next, arguments: { to, subject: intent.goal.slice(0, 80), ...(body ? { body } : { attachment: "report" }) }, reason };
    }
    case "upload_external":
      return { toolName: next, arguments: { destination: intent.allowedDestinations?.[0] ?? "unspecified", filename: "report.txt" }, reason };
    case "search_trains":
    case "search_flights":
      return { toolName: next, arguments: travelArgs(request), reason };
    case "book_ticket": {
      const found = latestOutput<{ options?: TravelOption[] }>(prior, ["search_trains", "search_flights"]);
      const options = [...(found?.options ?? [])].sort((a, b) => a.price - b.price);
      const within = typeof intent.budgetLimit === "number" ? options.filter((o) => o.price <= intent.budgetLimit!) : options;
      const pick = within[0] ?? options[0];
      if (!pick) return null;
      return { toolName: next, arguments: { option_id: pick.id, passengers: 1 }, reason: `Demo worker: booking the cheapest option${within.length ? " within budget" : ""}.` };
    }
    case "add_calendar_event": {
      const booking = latestOutput<{ option?: TravelOption }>(prior, ["book_ticket"]);
      const o = booking?.option;
      return {
        toolName: next,
        arguments: o
          ? { title: `${o.mode === "train" ? "Train" : "Flight"} ${o.from} → ${o.to} (${o.number})`, date: o.date, time: o.departs }
          : { title: intent.goal.slice(0, 80), date: parseDate(request) ?? isoDate(new Date(Date.now() + 86_400_000)) },
        reason,
      };
    }
    case "web_search":
      return { toolName: next, arguments: { query: request.replace(/^(please\s+)?(search( the)? (web|internet|online) for|look up|google|find out|tell me about)\s+/i, "").slice(0, 120) }, reason };
    default:
      return { toolName: next, arguments: {}, reason };
  }
}
