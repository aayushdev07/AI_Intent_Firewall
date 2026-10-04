/**
 * Simulated travel inventory. Deterministic for a given route and date, so demos are reproducible.
 * Carriers and trains are fictional. No real booking system is contacted.
 */

export type TravelMode = "train" | "flight";

export type TravelOption = {
  id: string;
  mode: TravelMode;
  operator: string;
  number: string;
  from: string;
  to: string;
  date: string;
  departs: string;
  arrives: string;
  duration: string;
  travelClass: string;
  price: number;
  currency: "INR";
  seatsLeft: number;
};

const TRAINS = ["Sahyadri Superfast", "Deccan Intercity", "Coastal Express", "Western Mail", "Shatabdi Link", "Night Rider Express"];
const AIRLINES = ["SkyBharat", "Aerolink", "Coastal Air", "IndusJet"];
const TRAIN_CLASSES = ["Sleeper (SL)", "AC 3 Tier (3A)", "AC Chair Car (CC)", "AC 2 Tier (2A)"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const pad = (n: number) => String(n).padStart(2, "0");
const title = (s: string) => s.trim().replace(/\s+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function travelOptions(mode: TravelMode, fromRaw: string, toRaw: string, date: string): TravelOption[] {
  const from = title(fromRaw);
  const to = title(toRaw);
  const r = rng(hash(`${mode}|${from.toLowerCase()}|${to.toLowerCase()}|${date}`));
  const count = 4;
  const out: TravelOption[] = [];
  for (let i = 0; i < count; i++) {
    const depMin = Math.floor((5 + i * 4 + r() * 3) * 60);
    const durMin = mode === "train" ? Math.floor(150 + r() * 420) : Math.floor(70 + r() * 110);
    const arrMin = depMin + durMin;
    const base = mode === "train" ? 240 + r() * 1400 : 3200 + r() * 6200;
    const price = Math.round(base / 10) * 10;
    const operator = mode === "train" ? TRAINS[Math.floor(r() * TRAINS.length)] : AIRLINES[Math.floor(r() * AIRLINES.length)];
    const number = mode === "train" ? String(11000 + Math.floor(r() * 8999)) : `${operator.slice(0, 2).toUpperCase()}-${100 + Math.floor(r() * 899)}`;
    const code = (hash(`${from}${to}${date}${i}${mode}`) % 46656).toString(36).toUpperCase().padStart(3, "0");
    out.push({
      id: `${mode === "train" ? "TR" : "FL"}-${code}${i + 1}`,
      mode,
      operator,
      number,
      from,
      to,
      date,
      departs: `${pad(Math.floor(depMin / 60) % 24)}:${pad(depMin % 60)}`,
      arrives: `${pad(Math.floor(arrMin / 60) % 24)}:${pad(arrMin % 60)}${arrMin >= 1440 ? " (+1)" : ""}`,
      duration: `${Math.floor(durMin / 60)}h ${pad(durMin % 60)}m`,
      travelClass: mode === "train" ? TRAIN_CLASSES[Math.floor(r() * TRAIN_CLASSES.length)] : "Economy",
      price,
      currency: "INR",
      seatsLeft: 1 + Math.floor(r() * 40),
    });
  }
  return out.sort((a, b) => a.departs.localeCompare(b.departs));
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Best-effort date from natural language. Returns YYYY-MM-DD or undefined. */
export function parseDate(text: string, now = new Date()): string | undefined {
  const t = text.toLowerCase();
  const day = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    return isoDate(d);
  };
  if (/\bday after tomorrow\b/.test(t)) return day(2);
  if (/\btomorrow\b/.test(t)) return day(1);
  if (/\b(today|tonight)\b/.test(t)) return day(0);
  const iso = t.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return `${iso[1]}-${pad(+iso[2])}-${pad(+iso[3])}`;
  const dm = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]{3})[a-z]*\b/) ?? null;
  const md = t.match(/\b([a-z]{3})[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?\b/) ?? null;
  const pick = (dd: number, mon: string) => {
    const m = MONTHS.indexOf(mon);
    if (m < 0 || dd < 1 || dd > 31) return undefined;
    let y = now.getFullYear();
    if (new Date(y, m, dd) < new Date(now.getFullYear(), now.getMonth(), now.getDate())) y++;
    return `${y}-${pad(m + 1)}-${pad(dd)}`;
  };
  if (dm) {
    const v = pick(+dm[1], dm[2]);
    if (v) return v;
  }
  if (md) {
    const v = pick(+md[2], md[1]);
    if (v) return v;
  }
  const slash = t.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/);
  if (slash) {
    const y = slash[3] ? (slash[3].length === 2 ? 2000 + +slash[3] : +slash[3]) : now.getFullYear();
    return `${y}-${pad(+slash[2])}-${pad(+slash[1])}`;
  }
  const wd = WEEKDAYS.findIndex((w) => new RegExp(`\\b(next |this |on )?${w}\\b`).test(t));
  if (wd >= 0) {
    let diff = (wd - now.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    return day(diff);
  }
  return undefined;
}

const STOP = /\s+(?:on|by|for|at|tomorrow|today|tonight|next|this|under|below|within|and|then|in|with|before|after|around)\b.*$/i;

/** "from Mumbai to Pune", "Mumbai to Pune", "to Pune from Mumbai". */
export function parseRoute(text: string): { from?: string; to?: string } {
  const clean = (s?: string) => (s ? title(s.replace(STOP, "").replace(/[^a-z\s.-]/gi, " ").trim()) || undefined : undefined);
  const a = text.match(/\bfrom\s+([a-z][a-z\s.-]{1,40}?)\s+to\s+([a-z][a-z\s.-]{1,40})/i);
  if (a) return { from: clean(a[1]), to: clean(a[2]) };
  const b = text.match(/\bto\s+([a-z][a-z\s.-]{1,40}?)\s+from\s+([a-z][a-z\s.-]{1,40})/i);
  if (b) return { from: clean(b[2]), to: clean(b[1]) };
  const c = text.match(/\b(?:train|trains|flight|flights|ticket|tickets|bus)\s+(?:ticket\s+)?([a-z][a-z.-]{2,30})\s+to\s+([a-z][a-z\s.-]{1,40})/i);
  if (c) return { from: clean(c[1]), to: clean(c[2]) };
  return {};
}

export function parseTravelMode(text: string): TravelMode | undefined {
  if (/\b(flight|flights|fly|plane|airline|air ticket)\b/i.test(text)) return "flight";
  if (/\b(train|trains|rail|railway|irctc)\b/i.test(text)) return "train";
  return undefined;
}
