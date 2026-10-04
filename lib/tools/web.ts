import { detectInjection } from "@/lib/firewall/injection";
import type { ToolExecutor } from "./types";

/**
 * web_search — REAL lookup using Wikipedia's public search API (no key needed).
 * Results are UNTRUSTED EXTERNAL CONTENT, exactly like emails: they can inform
 * the agent but can never authorize an action.
 */
const ENDPOINT = "https://en.wikipedia.org/w/api.php";

type WikiHit = { title: string; snippet: string; pageid: number };

export const webSearch: ToolExecutor = async (args) => {
  const query = typeof args.query === "string" ? args.query.trim().slice(0, 200) : "";
  if (!query) return { output: { error: "A search query is required.", results: [] }, meta: { untrusted: true } };
  const url = `${ENDPOINT}?action=query&list=search&format=json&srlimit=5&utf8=1&origin=*&srsearch=${encodeURIComponent(query)}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "IntentGuard-demo/1.0 (educational prototype)" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { query?: { search?: WikiHit[] } };
    const results = (data.query?.search ?? []).map((h) => {
      const snippet = h.snippet.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#039;/g, "'");
      return { title: h.title, snippet, url: `https://en.wikipedia.org/?curid=${h.pageid}` };
    });
    const inj = detectInjection(results.map((r) => `${r.title}\n${r.snippet}`).join("\n"));
    return {
      output: { source: "Wikipedia (live)", trust: "UNTRUSTED_EXTERNAL_CONTENT", query, results },
      meta: { untrusted: true, injectionDetected: inj.detected, injectionSignals: inj.signals, realWorld: true },
    };
  } catch (err) {
    return {
      output: { source: "Wikipedia (live)", query, results: [], error: `Search unavailable (${err instanceof Error ? err.message : "network error"}). Check the internet connection.` },
      meta: { untrusted: true },
    };
  } finally {
    clearTimeout(t);
  }
};
