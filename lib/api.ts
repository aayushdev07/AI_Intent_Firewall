import { NextResponse } from "next/server";
import { ServiceError } from "@/lib/services/run-service";

/** Uniform JSON error handling for API routes. Internal errors never leak stack traces. */
export async function handle<T>(fn: () => Promise<T>) {
  try {
    return NextResponse.json(await fn());
  } catch (err) {
    if (err instanceof ServiceError) return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    console.error("[IntentGuard API]", err);
    const message = err instanceof Error && /prisma|database|sqlite/i.test(err.message)
      ? "Database unavailable. Run `npm run setup` and restart the server."
      : "Internal error. The action was not executed.";
    return NextResponse.json({ error: message, code: "INTERNAL" }, { status: 500 });
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new ServiceError("Request body must be a JSON object.", 400, "MALFORMED_JSON");
  }
}

export function str(v: unknown, field: string): string {
  if (typeof v !== "string" || !v.trim()) throw new ServiceError(`"${field}" is required.`, 400, "INVALID_INPUT");
  return v;
}
