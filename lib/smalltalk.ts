/**
 * Conversational messages ("hello", "thanks", "what can you do?") get a direct reply.
 * They never create an agent run, so the model cannot turn a greeting into actions.
 * Deterministic on purpose: fast, predictable, and impossible to prompt-inject.
 */

export type MessageKind = "greeting" | "thanks" | "farewell" | "capabilities" | "identity" | "ack" | "task";

const CLEAN = /[^\p{L}\p{N}\s']/gu;

const PATTERNS: [Exclude<MessageKind, "task">, RegExp][] = [
  ["greeting", /^(hi+|hey+|hello+|helo|hiya|yo|namaste|good (morning|afternoon|evening|night)|gm|sup|what'?s up|wassup)( there| assistant| intentguard| claude| bot)?$/],
  ["thanks", /^(thanks?( you)?( so much| a lot)?|thx|ty|thank u|great thanks|cool thanks|ok thanks|okay thanks)$/],
  ["farewell", /^(bye+|goodbye|see you|see ya|cya|good night|gn|that'?s all|nothing else)$/],
  [
    "capabilities",
    /^(help|what can you do|what do you do|how can you help( me)?|what are you able to do|what can i ask( you)?|how does this work|how do i use (this|you)|what should i ask)$/,
  ],
  ["identity", /^(who are you|what are you|what is intentguard|what'?s intentguard|are you (a bot|an ai|human)|your name|what is your name)$/],
  ["ack", /^(ok+|okay|k|cool|nice|great|good|fine|sure|alright|got it|hmm+|yes|no|yep|nope)$/],
];

export function classifyMessage(text: string): MessageKind {
  const t = text.toLowerCase().replace(CLEAN, " ").replace(/\s+/g, " ").trim();
  if (!t) return "ack";
  for (const [kind, re] of PATTERNS) if (re.test(t)) return kind;
  return "task";
}

const WHAT_I_DO =
  "I can look things up on the live web, open pages and public APIs, search and book trains and flights, add calendar events, send emails, and work with your sales data, inbox and reports.";

const EXAMPLES = "For example: “Find trains from Mumbai to Pune tomorrow and book the cheapest one under ₹800.”";

export function smalltalkReply(kind: Exclude<MessageKind, "task">): string {
  switch (kind) {
    case "greeting":
      return `Hi! ${WHAT_I_DO} What would you like me to do? ${EXAMPLES}`;
    case "thanks":
      return "You're welcome! Let me know if there's anything else you'd like me to do.";
    case "farewell":
      return "Bye for now. Your chats and action receipts will be here when you come back.";
    case "capabilities":
      return `${WHAT_I_DO} Every step I take is checked against what you asked for. If a step looks risky, I'll pause and ask you first, and anything that doesn't match your request is blocked. ${EXAMPLES}`;
    case "identity":
      return `I'm an assistant protected by IntentGuard. ${WHAT_I_DO} IntentGuard checks each of my actions against your request before it runs.`;
    case "ack":
      return "Okay. Tell me what you'd like me to do next.";
  }
}

/** Reply when a message doesn't map to anything the assistant's tools can do. */
export const OUT_OF_SCOPE_REPLY = `I can't help with that one here. ${WHAT_I_DO} ${EXAMPLES}`;
