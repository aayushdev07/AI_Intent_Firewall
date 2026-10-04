import { handle, readJson, str } from "@/lib/api";
import { createIntentDraft } from "@/lib/services/run-service";

export const dynamic = "force-dynamic";

/** POST { userRequest, parser?: "auto" | "rule" } → { intent } (DRAFT, not yet immutable) */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson(req);
    const intent = await createIntentDraft(str(body.userRequest, "userRequest"), { parser: body.parser === "rule" ? "rule" : "auto" });
    return { intent };
  });
}
