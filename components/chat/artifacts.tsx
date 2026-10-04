import { CalendarPlus, FileText, Globe, Mail, MailWarning, Plane, Send, TrainFront, Ticket } from "lucide-react";
import type { RunAction } from "@/components/run/types";

type Report = { reportId: string; title: string; sections: { heading: string; body: string }[] };
type Emails = { count: number; emails: { id: string; from: string; subject: string; receivedAt?: string; suspectedInjection?: boolean }[] };
type Sent = { to?: string; subject?: string; attachment?: string | null; destination?: string; filename?: string; status?: string; error?: string };
type Option = { id: string; mode: "train" | "flight"; operator: string; number: string; from: string; to: string; date: string; departs: string; arrives: string; duration: string; travelClass: string; price: number; seatsLeft: number };
type Search = { mode: "train" | "flight"; from: string; to: string; date: string; options: Option[]; error?: string };
type Booking = { status: string; bookingRef?: string; option?: Option; passengerName?: string; passengers?: number; totalPaid?: number; error?: string };
type CalEvent = { title: string; date: string; time?: string | null };
type Web = { query: string; results: { title: string; snippet: string; url: string }[]; error?: string };
type Fetched = { url: string; status?: number; contentType?: string; truncated?: boolean; body?: unknown; error?: string };

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function Shell({ icon, title, right, children }: { icon: React.ReactNode; title: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <article className="overflow-hidden rounded-xl border border-steel-line bg-ink-2 shadow-card">
      <header className="flex items-center gap-2 border-b border-steel-line bg-ink-3/60 px-4 py-2.5">
        {icon}
        <h4 className="text-sm font-semibold text-fog">{title}</h4>
        {right ? <span className="ml-auto text-[11px] text-fog-mute">{right}</span> : null}
      </header>
      {children}
    </article>
  );
}

function SearchCard({ data, booked }: { data: Search; booked?: string }) {
  const Icon = data.mode === "flight" ? Plane : TrainFront;
  if (data.error) return null;
  const cheapest = Math.min(...data.options.map((o) => o.price));
  return (
    <Shell icon={<Icon className="size-4 text-signal" aria-hidden />} title={`${data.mode === "flight" ? "Flights" : "Trains"}: ${data.from} → ${data.to}`} right={`${data.date} · demo data`}>
      <ul className="divide-y divide-steel-line/70">
        {data.options.map((o) => (
          <li key={o.id} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm ${booked === o.id ? "bg-allow-bg/60" : ""}`}>
            <div className="min-w-[9rem]">
              <p className="font-medium text-fog">{o.departs} → {o.arrives}</p>
              <p className="text-xs text-fog-mute">{o.duration}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-fog">{o.operator} <span className="text-fog-mute">{o.number}</span></p>
              <p className="text-xs text-fog-mute">{o.travelClass}, {o.seatsLeft} seats left</p>
            </div>
            <div className="text-right">
              <p className="font-medium text-fog">{inr(o.price)}</p>
              <p className="text-[11px] text-fog-mute">{booked === o.id ? "Booked" : o.price === cheapest ? "Cheapest" : o.id}</p>
            </div>
          </li>
        ))}
      </ul>
    </Shell>
  );
}

function BookingCard({ data }: { data: Booking }) {
  if (!data.option || !data.bookingRef) {
    return <p className="text-sm text-block">{data.error ?? "The booking didn't go through."}</p>;
  }
  const o = data.option;
  return (
    <Shell icon={<Ticket className="size-4 text-allow" aria-hidden />} title="Booking confirmed" right={data.bookingRef}>
      <div className="grid gap-3 px-4 py-3 text-sm sm:grid-cols-2">
        <div>
          <p className="font-medium text-fog">{o.operator} {o.number}</p>
          <p className="text-fog-dim">{o.from} → {o.to}</p>
          <p className="text-fog-dim">{o.date}, {o.departs} → {o.arrives}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-fog-dim">{data.passengerName}{data.passengers && data.passengers > 1 ? ` + ${data.passengers - 1}` : ""}, {o.travelClass}</p>
          <p className="text-base font-semibold text-fog">{inr(data.totalPaid ?? o.price)}</p>
        </div>
      </div>
      <p className="border-t border-steel-line px-4 py-2 text-xs text-fog-mute">Simulated booking. No ticket was issued and no money was charged.</p>
    </Shell>
  );
}

function CalendarCard({ data }: { data: CalEvent }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-steel-line bg-ink-2 px-4 py-3 shadow-card">
      <CalendarPlus className="mt-0.5 size-4 text-signal" aria-hidden />
      <div className="text-sm">
        <p className="font-medium text-fog">{data.title}</p>
        <p className="text-fog-dim">{data.date}{data.time ? `, ${data.time}` : ""}</p>
        <p className="mt-1 text-xs text-fog-mute">Added to the demo calendar.</p>
      </div>
    </div>
  );
}

function WebCard({ data }: { data: Web }) {
  return (
    <Shell icon={<Globe className="size-4 text-signal" aria-hidden />} title={`Web results for “${data.query}”`} right="Wikipedia, live">
      {data.error ? (
        <p className="px-4 py-3 text-sm text-fog-dim">{data.error}</p>
      ) : data.results.length === 0 ? (
        <p className="px-4 py-3 text-sm text-fog-dim">No results found.</p>
      ) : (
        <ul className="divide-y divide-steel-line/70">
          {data.results.map((r) => (
            <li key={r.url} className="px-4 py-2.5 text-sm">
              <a href={r.url} target="_blank" rel="noreferrer noopener" className="font-medium text-signal hover:underline">{r.title}</a>
              <p className="mt-0.5 text-fog-dim">{r.snippet}…</p>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-steel-line px-4 py-2 text-xs text-fog-mute">Web content is treated as information only. It can&apos;t give the assistant permission to do anything.</p>
    </Shell>
  );
}

function ReportCard({ report }: { report: Report }) {
  return (
    <article className="overflow-hidden rounded-xl border border-steel-line bg-ink-2 shadow-card">
      <header className="flex items-center gap-2 border-b border-steel-line bg-ink-3/60 px-4 py-2.5">
        <FileText className="size-4 text-signal" aria-hidden />
        <h4 className="text-sm font-semibold text-fog">{report.title}</h4>
        <span className="ml-auto font-mono text-[11px] text-fog-mute">{report.reportId}</span>
      </header>
      <div className="space-y-3 px-4 py-3">
        {report.sections.length ? (
          report.sections.map((s, i) => (
            <section key={i}>
              <h5 className="text-xs font-semibold uppercase tracking-wide text-fog-mute">{s.heading}</h5>
              <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-fog">{s.body.replace(/ · /g, "\n")}</p>
            </section>
          ))
        ) : (
          <p className="text-sm text-fog-dim">The report was created, but there were no figures to include.</p>
        )}
      </div>
    </article>
  );
}

function EmailsCard({ data }: { data: Emails }) {
  return (
    <article className="overflow-hidden rounded-xl border border-steel-line bg-ink-2 shadow-card">
      <header className="flex items-center gap-2 border-b border-steel-line bg-ink-3/60 px-4 py-2.5">
        <Mail className="size-4 text-signal" aria-hidden />
        <h4 className="text-sm font-semibold text-fog">Inbox ({data.count})</h4>
      </header>
      <ul className="divide-y divide-steel-line/70">
        {data.emails.map((e) => (
          <li key={e.id} className="px-4 py-2.5 text-sm">
            <div className="flex items-start gap-2">
              {e.suspectedInjection ? <MailWarning className="mt-0.5 size-4 shrink-0 text-warn" aria-label="Contains instructions" /> : null}
              <div className="min-w-0">
                <p className="font-medium text-fog">{e.subject}</p>
                <p className="text-xs text-fog-mute">{e.from}</p>
                {e.suspectedInjection ? (
                  <p className="mt-1 text-xs text-warn">This email tried to give the assistant instructions. It was treated as information only.</p>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}

function SentCard({ data, kind }: { data: Sent; kind: "email" | "upload" }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-steel-line bg-ink-2 px-4 py-3 shadow-card">
      <Send className="mt-0.5 size-4 text-signal" aria-hidden />
      <div className="text-sm">
        {kind === "email" ? (
          <>
            <p className="font-medium text-fog">Email to {data.to}</p>
            {data.subject ? <p className="text-fog-dim">Subject: {data.subject}</p> : null}
            {data.attachment ? <p className="text-fog-dim">Attached: {data.attachment}</p> : null}
          </>
        ) : (
          <p className="font-medium text-fog">
            Uploaded {data.filename ?? "file"} to {data.destination}
          </p>
        )}
        <p className="mt-1 text-xs text-fog-mute">
          {data.status === "SENT" ? "Real email sent through your SMTP server." : data.status === "FAILED" ? `Sending failed: ${data.error ?? "unknown error"}` : "Simulated. Nothing actually left this computer."}
        </p>
      </div>
    </div>
  );
}

function FetchCard({ data }: { data: Fetched }) {
  let host = data.url;
  try {
    host = new URL(data.url).host;
  } catch {
    /* keep raw */
  }
  const preview = typeof data.body === "string" ? data.body.slice(0, 600) : data.body != null ? JSON.stringify(data.body, null, 2).slice(0, 800) : "";
  return (
    <Shell icon={<Globe className="size-4 text-signal" aria-hidden />} title={`Fetched ${host}`} right={data.status ? `HTTP ${data.status}` : "live"}>
      {data.error ? (
        <p className="px-4 py-3 text-sm text-fog-dim">{data.error}</p>
      ) : (
        <pre className="max-h-56 overflow-auto px-4 py-3 font-mono text-xs leading-relaxed text-fog-dim">{preview}{data.truncated ? "\n…(truncated)" : ""}</pre>
      )}
      <p className="border-t border-steel-line px-4 py-2 text-xs text-fog-mute">Fetched live and treated as information only. It can&apos;t give the assistant new permissions.</p>
    </Shell>
  );
}

/** What the run produced, shown the way a user expects: the report, the emails, the message sent. */
export function Artifacts({ actions }: { actions: RunAction[] }) {
  const done = actions.filter((a) => a.status === "EXECUTED" && a.result);
  const items: React.ReactNode[] = [];
  const booking = done.find((a) => a.toolName === "book_ticket")?.result as Booking | undefined;
  const bookedId = booking?.option?.id;
  for (const a of done) {
    const r = a.result as Record<string, unknown>;
    if ((a.toolName === "search_trains" || a.toolName === "search_flights") && Array.isArray(r.options)) items.push(<SearchCard key={a.id} data={r as unknown as Search} booked={bookedId} />);
    if (a.toolName === "book_ticket") items.push(<BookingCard key={a.id} data={r as unknown as Booking} />);
    if (a.toolName === "add_calendar_event") items.push(<CalendarCard key={a.id} data={r as unknown as CalEvent} />);
    if (a.toolName === "web_search" && Array.isArray(r.results)) items.push(<WebCard key={a.id} data={r as unknown as Web} />);
    if (a.toolName === "http_get" && (typeof r.body !== "undefined" || r.error)) items.push(<FetchCard key={a.id} data={r as unknown as Fetched} />);
    if (a.toolName === "create_report" && Array.isArray(r.sections)) items.push(<ReportCard key={a.id} report={r as unknown as Report} />);
    if (a.toolName === "read_emails" && Array.isArray(r.emails)) items.push(<EmailsCard key={a.id} data={r as unknown as Emails} />);
    if (a.toolName === "send_email") items.push(<SentCard key={a.id} data={r as Sent} kind="email" />);
    if (a.toolName === "upload_external") items.push(<SentCard key={a.id} data={r as Sent} kind="upload" />);
  }
  if (!items.length) return null;
  return <div className="space-y-3">{items}</div>;
}
