/**
 * Plain-language layer for the chat experience. Pure functions, safe in the browser.
 * It only rephrases what the deterministic engine decided; it never changes a decision.
 */

type Args = Record<string, unknown>;
const str = (v: unknown, fallback = "") => (typeof v === "string" && v.trim() ? v.trim() : fallback);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function monthName(v: unknown): string {
  const m = /^(\d{4})-(\d{2})$/.exec(str(v));
  if (!m) return "this month";
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

type ToolText = { doing: (a: Args) => string; done: (a: Args) => string; attempt: (a: Args) => string };

const TOOLS: Record<string, ToolText> = {
  read_sales_database: {
    doing: (a) => `Reading sales data for ${monthName(a.month)}`,
    done: (a) => `Read sales data for ${monthName(a.month)}`,
    attempt: (a) => `read sales data for ${monthName(a.month)}`,
  },
  read_customer_database: {
    doing: () => "Reading customer records",
    done: () => "Read customer records",
    attempt: (a) => `read customer records${str(a.fields) ? ` (${str(a.fields)})` : ""}`,
  },
  calculate_sales: {
    doing: () => "Calculating sales figures",
    done: () => "Calculated sales figures",
    attempt: () => "calculate sales figures",
  },
  create_report: {
    doing: (a) => `Writing the report${str(a.title) ? ` “${str(a.title)}”` : ""}`,
    done: (a) => `Created the report${str(a.title) ? ` “${str(a.title)}”` : ""}`,
    attempt: (a) => `create a report${str(a.title) ? ` “${str(a.title)}”` : ""}`,
  },
  read_emails: {
    doing: () => "Reading your inbox",
    done: () => "Read your inbox",
    attempt: () => "read your inbox",
  },
  create_file: {
    doing: (a) => `Saving a file${str(a.filename) ? ` (${str(a.filename)})` : ""}`,
    done: (a) => `Saved a file${str(a.filename) ? ` (${str(a.filename)})` : ""}`,
    attempt: (a) => `save ${str(a.content_source) ? `${str(a.content_source).replace(/_/g, " ")} into ` : ""}a file${str(a.filename) ? ` called ${str(a.filename)}` : ""}`,
  },
  send_email: {
    doing: (a) => `Emailing ${str(a.to, "someone")}`,
    done: (a) => `Sent an email to ${str(a.to, "the recipient")}`,
    attempt: (a) => `email ${str(a.attachment) ? `the ${str(a.attachment)} ` : ""}to ${str(a.to, "someone")}`,
  },
  search_trains: {
    doing: (a) => `Searching trains${route(a)}`,
    done: (a) => `Found trains${route(a)}`,
    attempt: (a) => `search trains${route(a)}`,
  },
  search_flights: {
    doing: (a) => `Searching flights${route(a)}`,
    done: (a) => `Found flights${route(a)}`,
    attempt: (a) => `search flights${route(a)}`,
  },
  book_ticket: {
    doing: (a) => `Booking option ${str(a.option_id, "")}`.trim(),
    done: (a) => `Booked option ${str(a.option_id, "")}`.trim(),
    attempt: (a) => `book and pay for option ${str(a.option_id, "(unknown)")}`,
  },
  add_calendar_event: {
    doing: (a) => `Adding “${str(a.title, "an event")}” to your calendar`,
    done: (a) => `Added “${str(a.title, "an event")}” to your calendar${str(a.date) ? ` on ${str(a.date)}` : ""}`,
    attempt: (a) => `add “${str(a.title, "an event")}” to your calendar`,
  },
  http_get: {
    doing: (a) => `Opening ${hostOf(a.url)}`,
    done: (a) => `Read ${hostOf(a.url)}`,
    attempt: (a) => `fetch ${hostOf(a.url)}`,
  },
  web_search: {
    doing: (a) => `Searching the web for “${str(a.query, "your question")}”`,
    done: (a) => `Searched the web for “${str(a.query, "your question")}”`,
    attempt: (a) => `search the web for “${str(a.query, "something")}”`,
  },
  upload_external: {
    doing: (a) => `Uploading to ${hostOf(a.destination)}`,
    done: (a) => `Uploaded to ${hostOf(a.destination)}`,
    attempt: (a) => `upload ${str(a.filename) ? `${str(a.filename)} ` : "data "}to ${hostOf(a.destination)}`,
  },
};

function route(a: Args): string {
  const from = str(a.from);
  const to = str(a.to);
  const date = str(a.date);
  return `${from && to ? ` from ${from} to ${to}` : to ? ` to ${to}` : ""}${date ? ` on ${date}` : ""}`;
}

function hostOf(v: unknown): string {
  const s = str(v, "an outside website");
  try {
    return new URL(s).host || s;
  } catch {
    return s;
  }
}

function fallback(tool: string): ToolText {
  const label = tool.replace(/_/g, " ");
  return { doing: () => `Running “${label}”`, done: () => `Ran “${label}”`, attempt: () => `run “${label}”` };
}

export const stepText = (tool: string, args: Args) => (TOOLS[tool] ?? fallback(tool));
export const doingText = (tool: string, args: Args) => stepText(tool, args).doing(args);
export const doneText = (tool: string, args: Args) => stepText(tool, args).done(args);
export const attemptText = (tool: string, args: Args) => stepText(tool, args).attempt(args);

/** Friendly names for intent resources and actions. */
const RESOURCE: Record<string, string> = {
  sales_data: "your sales data",
  sales_database: "your sales data",
  customer_data: "customer records",
  customer_database: "customer records",
  email_inbox: "your inbox",
  emails: "your inbox",
  inbox: "your inbox",
  reports: "reports",
  files: "files",
  travel: "train and flight search",
  web: "the web",
};
export const resourceLabel = (r: string) => RESOURCE[r] ?? r.replace(/_/g, " ");

const ACTION: Record<string, string> = {
  read_sales_database: "read sales data",
  read_customer_database: "read customer records",
  calculate_sales: "calculate figures",
  create_report: "write a report",
  read_emails: "read your inbox",
  create_file: "save files",
  send_email: "send email",
  upload_external: "upload outside the app",
  search_trains: "search trains",
  search_flights: "search flights",
  book_ticket: "book and pay for a ticket",
  add_calendar_event: "add to your calendar",
  web_search: "search the web",
  http_get: "read a web page",
};
export const actionLabel = (a: string) => ACTION[a] ?? a.replace(/_/g, " ");

type Violation = { code: string; message?: string; severity?: string };

const REASONS: [string, string][] = [
  ["R7", "The instruction came from the content of an email or file, not from you. Content the assistant reads can't give it new permissions."],
  ["R5", "It would move sensitive data, such as customer details, outside the app without your permission."],
  ["R4", "It would send something outside the app to a place you didn't ask for."],
  ["R8", "The assistant tried to change what you asked for."],
  ["R9", "The assistant tried to change the security rules."],
  ["R10", "This step was already stopped once and was tried again."],
  ["B2", "The assistant tried to book an option that didn't come from a real search result, so the price couldn't be checked."],
  ["B1", "It goes over the budget you set."],
  ["R11", "It spends money, and you didn't ask for a booking or payment."],
  ["R6", "It affects someone outside the app, and your request didn't say exactly who or where."],
  ["R3", "Customer records aren't needed for what you asked."],
  ["R2", "Sensitive data isn't needed for what you asked."],
];

/** One plain sentence explaining why IntentGuard stopped or paused a step. */
export function plainReason(decision: string | null, violations: Violation[], alignment: number | null): string {
  const codes = violations.map((v) => v.code);
  if (decision === "WARN" && codes.some((c) => c.startsWith("R11"))) {
    const msg = violations.find((v) => v.code.startsWith("R11"))?.message;
    return `This step spends money, so it needs your OK first.${msg && /₹/.test(msg) ? ` ${msg.replace(/ Confirm the payment\.$/, ".")}` : ""}`;
  }
  for (const [prefix, text] of REASONS) {
    if (codes.some((c) => c === prefix || c.startsWith(prefix + "_"))) return text;
  }
  if (decision === "BLOCK") {
    return alignment != null && alignment < 40 ? "This step has nothing to do with what you asked, and it was too risky to allow." : "This step was too risky to allow.";
  }
  if (decision === "WARN") return "This step is unusual for what you asked, so it needs your OK first.";
  return "This step matches what you asked.";
}

export function shortTitle(text: string, max = 52): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}
