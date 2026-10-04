import { detectInjection } from "@/lib/firewall/injection";
import type { ToolExecutor } from "./types";

/**
 * http_get — a REAL, read-only web fetch so the agent can act on the live internet
 * (public JSON APIs, pages). This is what makes the agent general rather than
 * database-bound. Three hard safety limits make it safe to expose:
 *   - GET only, https only;
 *   - blocks localhost and private/link-local IP ranges (no SSRF into the host);
 *   - caps the response size and time, and marks the result UNTRUSTED EXTERNAL CONTENT.
 * IntentGuard still governs it: the result can inform the agent but never authorizes anything.
 */
const PRIVATE_HOST =
  /^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|169\.254\.|::1|fe80:|fc00:|fd00:)|\.local$|\.internal$|metadata\.google\.internal/i;
const MAX_BYTES = 200_000;

export const httpGet: ToolExecutor = async (args) => {
  const raw = typeof args.url === "string" ? args.url.trim() : "";
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { output: { error: "A valid https URL is required." }, meta: { untrusted: true } };
  }
  if (url.protocol !== "https:") return { output: { error: "Only https URLs are allowed." }, meta: { untrusted: true } };
  if (PRIVATE_HOST.test(url.hostname)) return { output: { error: "That host is not allowed (local or private network)." }, meta: { untrusted: true } };

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "IntentGuard-demo/1.0 (educational prototype)", Accept: "application/json, text/plain, text/html;q=0.8" },
    });
    const type = res.headers.get("content-type") ?? "";
    const buf = await res.arrayBuffer();
    const bytes = buf.byteLength;
    let text = new TextDecoder().decode(buf.slice(0, MAX_BYTES));
    let body: unknown = text;
    if (/application\/json|\+json/.test(type)) {
      try {
        body = JSON.parse(text);
      } catch {
        /* keep text */
      }
    } else if (/text\/html/.test(type)) {
      // Strip tags so the model sees readable text, not markup.
      text = text
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 8000);
      body = text;
    }
    const inj = detectInjection(typeof body === "string" ? body : JSON.stringify(body).slice(0, 8000));
    return {
      output: { url: url.toString(), status: res.status, contentType: type, truncated: bytes > MAX_BYTES, trust: "UNTRUSTED_EXTERNAL_CONTENT", body },
      meta: { untrusted: true, injectionDetected: inj.detected, injectionSignals: inj.signals, realWorld: true },
    };
  } catch (err) {
    return {
      output: { url: url.toString(), error: `Fetch failed (${err instanceof Error ? (err.name === "AbortError" ? "timed out" : err.message) : "network error"}).` },
      meta: { untrusted: true },
    };
  } finally {
    clearTimeout(timer);
  }
};
