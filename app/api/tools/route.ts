import { NextResponse } from "next/server";
import { TOOL_METADATA } from "@/lib/tools/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ tools: TOOL_METADATA, notice: "All tools are simulated. No real email, uploads or customer data." });
}
