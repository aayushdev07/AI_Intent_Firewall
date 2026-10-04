import { prisma } from "@/lib/db/client";
import { intentView, type IntentView } from "@/lib/db/mappers";
import { shortTitle } from "@/lib/plain";
import { confirmIntent, createIntentDraft, decideApproval, getDemoUser, getRunDetail, ServiceError, startRun, type RunDetail } from "./run-service";
import { parseIntentRuleBased } from "@/lib/llm/intent-parser";
import { classifyMessage, OUT_OF_SCOPE_REPLY, smalltalkReply } from "@/lib/smalltalk";
import { getSettings } from "./settings";
import { driveRun, isDriving } from "./runner";
import { actionAlertInclude, alertFor } from "./alerts";
import { requiresConfirmation } from "@/lib/chat-policy";

export { requiresConfirmation };

const APPROVAL_TIMEOUT_MS = 15 * 60 * 1000;

/** A message that reads like a question or lookup the agent could answer from the web. */
function looksAnswerable(text: string): boolean {
  const t = text.trim();
  if (t.length < 3) return false;
  if (/\?$/.test(t)) return true;
  return /\b(who|what|when|where|why|how|which|is|are|was|were|does|do|did|tell me|explain|define|find|look up|search|latest|price of|weather|news)\b/i.test(t);
}

export type ChatStatus = "idle" | "running" | "waiting";

export type ConversationSummary = { id: string; title: string; updatedAt: string; status: ChatStatus };

export type ChatTurn = {
  intent: IntentView;
  /** Conversational reply (greeting, help, out-of-scope). Such turns never start an agent run. */
  reply: string | null;
  /** True when IntentGuard needs the user to confirm the understood request before the agent starts. */
  needsConfirmation: boolean;
  run: RunDetail | null;
};

export type ConversationDetail = { id: string; title: string; createdAt: string; turns: ChatTurn[]; status: ChatStatus };

function statusOf(runs: { status: string }[]): ChatStatus {
  if (runs.some((r) => r.status === "WAITING_APPROVAL")) return "waiting";
  if (runs.some((r) => r.status === "RUNNING")) return "running";
  return "idle";
}


export async function listConversations(): Promise<ConversationSummary[]> {
  const rows = await prisma.conversation.findMany({
    where: { archived: false },
    orderBy: { updatedAt: "desc" },
    take: 60,
    include: { intents: { select: { runs: { select: { status: true } } } } },
  });
  return rows.map((c) => ({ id: c.id, title: c.title, updatedAt: c.updatedAt.toISOString(), status: statusOf(c.intents.flatMap((i) => i.runs)) }));
}

/**
 * Chat runs wait on the server, so nobody steps them while an approval is pending.
 * Unanswered approvals past the timeout are denied here (fail closed) and the agent continues.
 */
export async function expireStaleApprovals() {
  const stale = await prisma.approval.findMany({
    where: { decision: "PENDING", createdAt: { lt: new Date(Date.now() - APPROVAL_TIMEOUT_MS) } },
    select: { actionId: true, action: { select: { runId: true, run: { select: { intent: { select: { conversationId: true } } } } } } },
  });
  for (const a of stale) {
    try {
      await decideApproval(a.actionId, "DENIED", "system", "Approval timed out — treated as denied.");
      if (a.action.run.intent.conversationId) driveRun(a.action.runId);
    } catch {
      /* already decided concurrently */
    }
  }
}

/** If the server restarted mid-run, pick chat runs back up where they stopped. */
function resumeOrphanedRuns(runs: { id: string; status: string }[]) {
  for (const r of runs) if (r.status === "RUNNING" && !isDriving(r.id)) driveRun(r.id);
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  await expireStaleApprovals();
  const c = await prisma.conversation.findUnique({
    where: { id },
    include: { intents: { orderBy: { createdAt: "asc" }, include: { runs: { orderBy: { startedAt: "desc" }, select: { id: true, status: true } } } } },
  });
  if (!c || c.archived) throw new ServiceError("Chat not found.", 404, "NOT_FOUND");
  resumeOrphanedRuns(c.intents.flatMap((i) => i.runs));
  const settings = await getSettings();
  const turns: ChatTurn[] = [];
  for (const i of c.intents) {
    const view = intentView(i);
    const runId = i.runs[0]?.id;
    const isChat = i.kind === "CHAT";
    turns.push({
      intent: view,
      reply: isChat ? (i.reply ?? OUT_OF_SCOPE_REPLY) : null,
      needsConfirmation: !isChat && view.status === "DRAFT" && requiresConfirmation(view, settings.experience.alwaysConfirm),
      run: runId ? await getRunDetail(runId) : null,
    });
  }
  return { id: c.id, title: c.title, createdAt: c.createdAt.toISOString(), turns, status: statusOf(c.intents.flatMap((i) => i.runs)) };
}

export async function archiveConversation(id: string) {
  await prisma.conversation.update({ where: { id }, data: { archived: true } }).catch(() => {
    throw new ServiceError("Chat not found.", 404, "NOT_FOUND");
  });
}

export async function renameConversation(id: string, title: string) {
  const t = title.trim().slice(0, 80);
  if (!t) throw new ServiceError("Title cannot be empty.");
  await prisma.conversation.update({ where: { id }, data: { title: t } });
}

async function draftWithFallback(message: string) {
  try {
    return await createIntentDraft(message, { parser: "auto" });
  } catch (err) {
    // If the model fails to produce a valid intent, the deterministic parser takes over.
    if (err instanceof ServiceError && err.code === "LLM_FAILED") return createIntentDraft(message, { parser: "rule" });
    throw err;
  }
}

async function ensureConversation(conversationId: string | null, text: string) {
  if (conversationId) {
    await prisma.conversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
    return conversationId;
  }
  return (await prisma.conversation.create({ data: { title: shortTitle(text) } })).id;
}

/** A conversational turn: stored for history, answered directly, never sent to the agent. */
async function createChatTurn(conversationId: string | null, text: string, reply: string) {
  const user = await getDemoUser();
  const convoId = await ensureConversation(conversationId, text);
  const row = await prisma.intent.create({
    data: {
      userId: user.id,
      userRequest: text,
      goal: "Conversation",
      constraints: "[]",
      allowedResources: "[]",
      expectedActions: "[]",
      restrictedActions: "[]",
      sensitiveDataAllowed: false,
      externalTransferAllowed: false,
      allowedDestinations: "[]",
      riskTolerance: "low",
      ambiguities: "[]",
      parserSource: "RULE_BASED",
      kind: "CHAT",
      reply,
      conversationId: convoId,
    },
  });
  return { conversationId: convoId, intentId: row.id, runId: null as string | null };
}

export async function sendMessage(conversationId: string | null, message: string) {
  const text = message.trim();
  if (!text) throw new ServiceError("Type a message first.");
  if (text.length > 1000) throw new ServiceError("Message is too long (max 1000 characters).");
  if (conversationId) {
    const c = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!c || c.archived) throw new ServiceError("Chat not found.", 404, "NOT_FOUND");
  }

  // Greetings, thanks and "what can you do?" are answered directly. No intent, no agent, no tools.
  const kind = classifyMessage(text);
  if (kind !== "task") return createChatTurn(conversationId, text, smalltalkReply(kind));

  if (conversationId) {
    const busy = await prisma.agentRun.count({ where: { intent: { conversationId }, status: { in: ["RUNNING", "WAITING_APPROVAL"] } } });
    if (busy) throw new ServiceError("The assistant is still working on your last request in this chat.", 409, "BUSY");
  }
  let intent = await draftWithFallback(text);
  const convoId = await ensureConversation(conversationId, text);

  // Guardrail on the model's plan: for common requests the deterministic parser is more reliable than a
  // small model. If the rule parser confidently finds a plan, prefer it so the live model can't wander
  // (e.g. turning "check flights" into a web search or a report).
  if (intent.parserSource === "LLM") {
    const rule = parseIntentRuleBased(text);
    const ruleIsConfident = rule.expectedActions.length > 0;
    const sameShape =
      ruleIsConfident &&
      intent.expectedActions.length > 0 &&
      intent.expectedActions.every((a) => rule.expectedActions.includes(a));
    if (ruleIsConfident && !sameShape) {
      intent = await createIntentDraft(text, { parser: "rule" });
      await prisma.intent.update({ where: { id: intent.id }, data: { conversationId: convoId } });
    }
  }

  // If no specific tool matched but the message is a real question, let the agent answer from the live web.
  if (intent.expectedActions.length === 0 && looksAnswerable(text)) {
    intent = await createIntentDraft(text, { parser: "rule", forceWebLookup: true });
    await prisma.intent.update({ where: { id: intent.id }, data: { conversationId: convoId } });
  }

  // Still nothing the tools can do: answer directly instead of starting an empty agent run.
  if (intent.expectedActions.length === 0) {
    await prisma.intent.update({ where: { id: intent.id }, data: { conversationId: convoId, kind: "CHAT", reply: OUT_OF_SCOPE_REPLY } });
    return { conversationId: convoId, intentId: intent.id, runId: null };
  }

  // Grounding check: if the model found actions the user's own words don't support, the user confirms first.
  const ambiguities = [...intent.ambiguities];
  if (intent.parserSource === "LLM" && parseIntentRuleBased(text).expectedActions.length === 0) {
    ambiguities.push("I wasn't fully sure this is a task, so please check what I understood before I start.");
  }
  const updated = await prisma.intent.update({
    where: { id: intent.id },
    data: { conversationId: convoId, ambiguities: JSON.stringify(ambiguities) },
  });
  intent = intentView(updated);

  const settings = await getSettings();
  let runId: string | null = null;
  if (!requiresConfirmation(intent, settings.experience.alwaysConfirm)) runId = await startFromIntent(intent.id);
  return { conversationId: convoId, intentId: intent.id, runId };
}

/** Confirms (and seals) the understood request, then starts the protected agent run. */
export async function startFromIntent(intentId: string) {
  const row = await prisma.intent.findUnique({ where: { id: intentId }, include: { runs: { select: { id: true } } } });
  if (!row) throw new ServiceError("Request not found.", 404, "NOT_FOUND");
  if (row.kind === "CHAT") throw new ServiceError("This message doesn't need the assistant to take any actions.", 409, "NOT_A_TASK");
  if (row.runs.length) return row.runs[0].id;
  await confirmIntent(intentId);
  const runId = (await startRun(intentId, { agent: "auto" })).id;
  if (row.conversationId) await prisma.conversation.update({ where: { id: row.conversationId }, data: { updatedAt: new Date() } });
  driveRun(runId);
  return runId;
}

/** Pending approvals (not yet timed out) and recent blocks, in plain language, for in-app alerts. */
export async function listAlerts(sinceIso: string | null) {
  await expireStaleApprovals();
  const cutoff = new Date(Date.now() - APPROVAL_TIMEOUT_MS);
  const pendingRows = await prisma.action.findMany({
    where: { decision: "WARN", approval: { decision: "PENDING", createdAt: { gt: cutoff } } },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { ...actionAlertInclude, approval: { select: { createdAt: true } } },
  });
  const since = sinceIso && !Number.isNaN(Date.parse(sinceIso)) ? new Date(sinceIso) : new Date(Date.now() - 60_000);
  const blockedRows = await prisma.action.findMany({
    where: { decision: "BLOCK", createdAt: { gt: since } },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: actionAlertInclude,
  });
  const map = (rows: typeof blockedRows) =>
    rows.flatMap((r) => {
      const a = alertFor(r);
      return a ? [{ ...a, createdAt: r.createdAt.toISOString() }] : [];
    });
  return { pending: map(pendingRows), blocked: map(blockedRows), serverTime: new Date().toISOString() };
}
