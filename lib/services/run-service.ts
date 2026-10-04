import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { parseJson } from "@/lib/db/json";
import { intentFromRow, intentView, trajectoryEntryFromRow } from "@/lib/db/mappers";
import { evaluateAction } from "@/lib/firewall/decision-engine";
import { executeGuarded, type GuardedAction } from "@/lib/firewall/execution-guard";
import { integrityHash, intentHash } from "@/lib/firewall/integrity";
import { buildTrajectoryState, PATTERN_LABELS, type TrajectoryPattern } from "@/lib/firewall/trajectory";
import { parseIntentRuleBased, extractIntentWithLLM } from "@/lib/llm/intent-parser";
import { proposeNextAction, type StepSummary } from "@/lib/llm/worker-agent";
import { demoNextAction } from "@/lib/llm/demo-worker";
import { checkLMStudioConnection } from "@/lib/llm/lmstudio";
import { getScenario } from "@/lib/scenarios";
import { nextReceiptId, receiptPayload } from "@/lib/receipts";
import { recordProvenance, userAuthority } from "@/lib/provenance";
import { getSettings, firewallConfig, lmConfig } from "./settings";
import type { ActionProposal, ActionStatus, Decision, IntentDraft, ProposedBy, ResultMeta, RunMode } from "@/lib/types";
import type { PriorResult } from "@/lib/tools/types";

export const MAX_STEPS = 12;
export const MAX_CONSECUTIVE_BLOCKS = 3;
export const APPROVAL_TIMEOUT_MS = 15 * 60 * 1000;

export class ServiceError extends Error {
  constructor(message: string, public status = 400, public code = "BAD_REQUEST") {
    super(message);
  }
}

const STATUS_FOR: Record<Decision, ActionStatus> = { ALLOW: "ALLOWED", WARN: "WARNED", BLOCK: "BLOCKED" };
const SEVERITY: Record<Decision, number> = { ALLOW: 0, WARN: 1, BLOCK: 2 };

export async function getDemoUser() {
  return prisma.user.upsert({
    where: { email: "demo.user@example.com" },
    create: { name: "Demo User", email: "demo.user@example.com" },
    update: {},
  });
}

export async function modelAvailability() {
  const settings = await getSettings();
  const status = await checkLMStudioConnection(lmConfig(settings));
  const live = !settings.demo.demoMode && status.reachable && status.modelAvailable && status.modelLoaded !== false;
  // Talk to whichever model is actually loaded, even if the saved id differs (e.g. Gemma loaded, config still Qwen).
  const liveConfig = { ...lmConfig(settings), model: status.effectiveModel };
  return { settings, status, live, liveConfig };
}

// ── Intent ────────────────────────────────────────────────────────────────

export async function createIntentDraft(userRequest: string, opts: { parser?: "auto" | "rule"; forceWebLookup?: boolean } = {}) {
  const request = userRequest.trim();
  if (!request) throw new ServiceError("Enter a task for the agent.");
  if (request.length > 1000) throw new ServiceError("Task is too long (max 1000 characters).");
  const { live, liveConfig } = await modelAvailability();

  let draft: IntentDraft;
  let parserSource: "LLM" | "RULE_BASED";
  if (opts.parser !== "rule" && live) {
    try {
      draft = await extractIntentWithLLM(liveConfig, request);
      parserSource = "LLM";
    } catch (err) {
      throw new ServiceError(
        `The agent model could not understand the request: ${err instanceof Error ? err.message : "unknown error"}. Try again, or use the rule-based parser.`,
        502,
        "LLM_FAILED",
      );
    }
  } else {
    draft = parseIntentRuleBased(request);
    parserSource = "RULE_BASED";
  }
  if (opts.forceWebLookup && draft.expectedActions.length === 0) {
    draft = {
      ...draft,
      allowedResources: Array.from(new Set([...draft.allowedResources, "web"])),
      expectedActions: ["web_search", "http_get"],
      restrictedActions: draft.restrictedActions.filter((a) => a !== "web_search" && a !== "http_get"),
      ambiguities: draft.ambiguities.filter((a) => !/No specific data source or action/.test(a)),
    };
  }

  const user = await getDemoUser();
  const row = await prisma.intent.create({
    data: {
      userId: user.id,
      userRequest: request,
      goal: draft.goal,
      constraints: JSON.stringify(draft.constraints ?? []),
      allowedResources: JSON.stringify(draft.allowedResources),
      expectedActions: JSON.stringify(draft.expectedActions),
      restrictedActions: JSON.stringify(draft.restrictedActions),
      sensitiveDataAllowed: draft.sensitiveDataAllowed,
      externalTransferAllowed: draft.externalTransferAllowed,
      allowedDestinations: JSON.stringify(draft.allowedDestinations ?? []),
      budgetLimit: draft.budgetLimit ?? null,
      riskTolerance: draft.riskTolerance,
      ambiguities: JSON.stringify(draft.ambiguities),
      parserSource,
      status: "DRAFT",
    },
  });
  return intentView(row);
}

/** User confirmation makes the intent immutable and fingerprints it. */
export async function confirmIntent(intentId: string) {
  const row = await prisma.intent.findUnique({ where: { id: intentId } });
  if (!row) throw new ServiceError("Intent not found.", 404, "NOT_FOUND");
  if (row.kind === "CHAT") throw new ServiceError("A conversational message cannot be confirmed as a task.", 409, "NOT_A_TASK");
  if (row.status === "CONFIRMED") return intentView(row);
  const view = intentView(row);
  const hash = intentHash({ ...view, budgetLimit: view.budgetLimit });
  const updated = await prisma.intent.update({
    where: { id: intentId },
    data: { status: "CONFIRMED", immutable: true, contentHash: hash, confirmedAt: new Date() },
  });
  return intentView(updated);
}

function intentIntact(row: Parameters<typeof intentView>[0]): boolean {
  const view = intentView(row);
  return Boolean(row.contentHash) && intentHash({ ...view, budgetLimit: view.budgetLimit }) === row.contentHash;
}

// ── Runs ──────────────────────────────────────────────────────────────────

export async function startRun(intentId: string, opts: { scenarioId?: string; agent?: "scripted" | "live" | "auto" } = {}) {
  const intentRow = await prisma.intent.findUnique({ where: { id: intentId } });
  if (!intentRow) throw new ServiceError("Intent not found.", 404, "NOT_FOUND");
  if (intentRow.status !== "CONFIRMED" || !intentRow.immutable) throw new ServiceError("Confirm the Original Intent before starting the agent.", 409, "INTENT_NOT_CONFIRMED");

  const scenario = getScenario(opts.scenarioId);
  if (opts.scenarioId && !scenario) throw new ServiceError("Unknown scenario.", 400, "INVALID_INPUT");
  const { live, settings } = await modelAvailability();
  if (scenario?.id === "prompt-injection" && !settings.demo.promptInjectionScenario) {
    throw new ServiceError("The prompt-injection scenario is disabled in Settings.", 409, "SCENARIO_DISABLED");
  }
  let mode: RunMode;
  if (scenario && opts.agent !== "live") mode = "SCRIPTED";
  else if (opts.agent === "live" && !live) throw new ServiceError("The agent model is not connected. Start your local model server or use Demo Mode.", 503, "LM_OFFLINE");
  else mode = live ? "LIVE" : "DEMO";

  const run = await prisma.$transaction(async (tx) => {
    const r = await tx.agentRun.create({ data: { intentId, mode, scenario: scenario?.id ?? null, status: "RUNNING" } });
    await tx.trajectory.create({ data: { runId: r.id, sequence: "[]", patterns: "[]", maxRisk: 0 } });
    const authority = userAuthority(intentId);
    await recordProvenance(tx, { runId: r.id, actor: "User", action: "Confirmed Original Intent", authoritySource: "user" });
    await recordProvenance(tx, { runId: r.id, actor: "Orchestrator (main agent)", parent: "User", action: "Started agent run", authoritySource: authority });
    await recordProvenance(tx, {
      runId: r.id,
      actor: `Worker Agent (${mode === "LIVE" ? `model: ${settings.lmStudioModel}` : mode === "SCRIPTED" ? "scripted replay" : "demo"})`,
      parent: "Orchestrator (main agent)",
      action: "Delegated planning — propose-only, no execution rights",
      authoritySource: authority,
    });
    return r;
  });
  return run;
}

async function loadRun(runId: string) {
  const run = await prisma.agentRun.findUnique({
    where: { id: runId },
    include: { intent: true, actions: { include: { approval: true }, orderBy: { sequence: "asc" } } },
  });
  if (!run) throw new ServiceError("Run not found.", 404, "NOT_FOUND");
  return run;
}

type LoadedRun = Awaited<ReturnType<typeof loadRun>>;

/** Pending approvals older than the timeout are treated as DENIED (fail closed). */
async function expireApprovals(run: LoadedRun) {
  const now = Date.now();
  for (const a of run.actions) {
    if (a.approval?.decision === "PENDING" && now - a.approval.createdAt.getTime() > APPROVAL_TIMEOUT_MS) {
      await decideApproval(a.id, "DENIED", "system", "Approval timed out — treated as denied.");
    }
  }
}

function priorResults(run: LoadedRun): PriorResult[] {
  return run.actions
    .filter((a) => a.status === "EXECUTED")
    .map((a) => ({ toolName: a.toolName, output: parseJson(a.result, null), meta: parseJson<ResultMeta>(a.resultMeta, {}) }));
}

function stepSummaries(run: LoadedRun): StepSummary[] {
  return run.actions.map((a) => {
    const meta = parseJson<ResultMeta>(a.resultMeta, {});
    return {
      sequence: a.sequence,
      toolName: a.toolName,
      arguments: parseJson(a.arguments, {}),
      decision: a.decision ?? undefined,
      status: a.status,
      approval: a.approval?.decision,
      result: parseJson(a.result, null),
      untrusted: meta.untrusted,
    };
  });
}

async function finishRun(runId: string, status: "COMPLETED" | "HALTED" | "FAILED", note?: string) {
  const actions = await prisma.action.findMany({ where: { runId } });
  const worst = actions.reduce<Decision | null>((w, a) => {
    const d = a.decision as Decision | null;
    if (!d) return w;
    return !w || SEVERITY[d] > SEVERITY[w] ? d : w;
  }, null);
  return prisma.agentRun.update({ where: { id: runId }, data: { status, finalDecision: worst, endedAt: new Date(), lastAgentNote: note ?? null } });
}

/** One agent step: the worker proposes exactly one action, IntentGuard decides. */
export async function stepRun(runId: string) {
  let run = await loadRun(runId);
  await expireApprovals(run);
  run = await loadRun(runId);
  if (run.status !== "RUNNING") return { run, outcome: "idle" as const };

  if (!intentIntact(run.intent)) {
    await finishRun(runId, "FAILED", "Original Intent integrity check failed. The run was stopped.");
    return { run: await loadRun(runId), outcome: "failed" as const };
  }
  const intent = intentFromRow(run.intent);
  if (!intent) throw new ServiceError("Run has no confirmed intent.", 409);

  if (run.actions.length >= MAX_STEPS) {
    await finishRun(runId, "COMPLETED", `Step limit (${MAX_STEPS}) reached.`);
    return { run: await loadRun(runId), outcome: "completed" as const };
  }

  let proposal: ActionProposal | null = null;
  let proposedBy: ProposedBy;
  if (run.mode === "SCRIPTED") {
    proposedBy = "SCRIPTED";
    proposal = getScenario(run.scenario)?.script[run.actions.length] ?? null;
    if (!proposal) {
      await finishRun(runId, "COMPLETED", "Scenario script finished.");
      return { run: await loadRun(runId), outcome: "completed" as const };
    }
  } else if (run.mode === "DEMO") {
    proposedBy = "DEMO";
    proposal = demoNextAction(intent, run.actions.map((a) => a.toolName), priorResults(run));
    if (!proposal) {
      await finishRun(runId, "COMPLETED", "Demo worker finished the expected actions.");
      return { run: await loadRun(runId), outcome: "completed" as const };
    }
  } else {
    proposedBy = "LLM";
    const { liveConfig } = await modelAvailability();
    const outcome = await proposeNextAction(liveConfig, run.intent.userRequest, intent, stepSummaries(run));
    if (outcome.kind === "error") {
      await finishRun(runId, "FAILED", `The agent model became unavailable: ${outcome.error}`);
      return { run: await loadRun(runId), outcome: "failed" as const };
    }
    if (outcome.kind === "done") {
      await finishRun(runId, "COMPLETED", outcome.note);
      return { run: await loadRun(runId), outcome: "completed" as const };
    }
    proposal = outcome.proposal;
    // A live model sometimes re-proposes a step it already completed. Don't repeat it; wrap up instead.
    const sig = JSON.stringify({ t: proposal.toolName, a: proposal.arguments });
    const already = run.actions.some((a) => a.status === "EXECUTED" && JSON.stringify({ t: a.toolName, a: parseJson(a.arguments, {}) }) === sig);
    if (already) {
      await finishRun(runId, "COMPLETED", "The assistant had no new step to take, so I wrapped up.");
      return { run: await loadRun(runId), outcome: "completed" as const };
    }
  }

  const processed = await processProposal(runId, proposal, proposedBy, { autoExecute: true });

  // Stop agents that keep getting blocked.
  const recent = await prisma.action.findMany({ where: { runId }, orderBy: { sequence: "desc" }, take: MAX_CONSECUTIVE_BLOCKS });
  if (recent.length === MAX_CONSECUTIVE_BLOCKS && recent.every((a) => a.decision === "BLOCK") && run.mode === "LIVE") {
    await finishRun(runId, "HALTED", `Agent halted after ${MAX_CONSECUTIVE_BLOCKS} consecutive blocked proposals.`);
  }
  return { run: await loadRun(runId), outcome: "action" as const, action: processed };
}

/**
 * The security boundary for one proposal: evaluate → persist decision, risk,
 * violations, trajectory, receipt and provenance → execute only if allowed.
 */
export async function processProposal(runId: string, rawProposal: unknown, proposedBy: ProposedBy, opts: { autoExecute: boolean }) {
  const run = await loadRun(runId);
  if (run.status === "WAITING_APPROVAL") throw new ServiceError("Resolve the pending approval first.", 409, "APPROVAL_PENDING");
  if (run.status !== "RUNNING") throw new ServiceError(`Run is ${run.status.toLowerCase()}.`, 409, "RUN_NOT_ACTIVE");

  const settings = await getSettings();
  const intent = intentIntact(run.intent) ? intentFromRow(run.intent) : null;
  const trajectory = run.actions.map(trajectoryEntryFromRow);
  const evaluation = evaluateAction(rawProposal, intent, trajectory, firewallConfig(settings));

  const p = (rawProposal ?? {}) as Partial<ActionProposal>;
  const toolName = typeof p.toolName === "string" && p.toolName ? p.toolName.slice(0, 120) : "(malformed)";
  const args = p.arguments && typeof p.arguments === "object" && !Array.isArray(p.arguments) ? (p.arguments as Record<string, unknown>) : {};
  const reason = typeof p.reason === "string" ? p.reason.slice(0, 1000) : "";
  const sequence = run.actions.length + 1;
  const authority = userAuthority(run.intentId);
  const flaggedExternal = evaluation.details.patterns.includes("UNTRUSTED_CONTENT_THEN_PRIVILEGED_ACTION");
  const status = STATUS_FOR[evaluation.decision];

  const action = await prisma.$transaction(async (tx) => {
    const created = await tx.action.create({
      data: {
        runId,
        sequence,
        toolName,
        arguments: JSON.stringify(args),
        reason,
        agentId: run.agentId,
        parentActionId: run.actions.at(-1)?.id ?? null,
        status,
        alignmentScore: evaluation.alignmentScore,
        riskScore: evaluation.riskScore,
        riskLevel: evaluation.riskLevel,
        decision: evaluation.decision,
        decisionReason: evaluation.reason,
        integrityHash: integrityHash(runId, sequence, toolName, args),
        authoritySource: flaggedExternal ? `${authority} (external content claimed authority — rejected)` : authority,
        proposedBy,
      },
    });
    await tx.riskAssessment.create({
      data: {
        runId,
        actionId: created.id,
        riskScore: evaluation.riskScore,
        riskLevel: evaluation.riskLevel,
        alignmentScore: evaluation.alignmentScore,
        factors: JSON.stringify(evaluation.details.riskFactors),
      },
    });
    for (const v of evaluation.details.violations) {
      await tx.policyViolation.create({ data: { runId, actionId: created.id, policyCode: v.code, message: v.message, severity: v.severity } });
    }
    if (evaluation.decision === "WARN") {
      await tx.approval.create({ data: { actionId: created.id, decision: "PENDING" } });
      await tx.agentRun.update({ where: { id: runId }, data: { status: "WAITING_APPROVAL" } });
    }
    const receiptId = await nextReceiptId(tx);
    await tx.actionReceipt.create({
      data: {
        receiptId,
        runId,
        actionId: created.id,
        userIntent: run.intent.goal,
        agent: "Worker Agent",
        toolName,
        alignment: evaluation.alignmentScore,
        risk: evaluation.riskScore,
        riskLevel: evaluation.riskLevel,
        decision: evaluation.decision,
        reason: evaluation.reason,
        violations: JSON.stringify(evaluation.violations),
        approvalStatus: evaluation.decision === "WARN" ? "PENDING" : null,
        payload: JSON.stringify(
          receiptPayload({
            receiptId, userIntent: run.intent.goal, intentHash: run.intent.contentHash, runId, actionId: created.id, sequence,
            toolName, args, reasonProposed: reason, proposedBy, evaluation,
          }),
        ),
      },
    });
    const traj = await tx.trajectory.findUnique({ where: { runId } });
    const seq = parseJson<{ tool: string; decision: string }[]>(traj?.sequence, []);
    seq.push({ tool: toolName, decision: evaluation.decision });
    const patterns = Array.from(new Set([...parseJson<string[]>(traj?.patterns, []), ...evaluation.details.patterns]));
    await tx.trajectory.upsert({
      where: { runId },
      create: { runId, sequence: JSON.stringify(seq), patterns: JSON.stringify(patterns), maxRisk: evaluation.riskScore },
      update: { sequence: JSON.stringify(seq), patterns: JSON.stringify(patterns), maxRisk: Math.max(traj?.maxRisk ?? 0, evaluation.riskScore) },
    });
    await tx.agentRun.update({ where: { id: runId }, data: { stepCount: sequence } });
    await recordProvenance(tx, {
      runId, actionId: created.id, actor: "Worker Agent", parent: "Orchestrator (main agent)", tool: toolName,
      action: `Proposed ${toolName}`, authoritySource: created.authoritySource,
    });
    await recordProvenance(tx, {
      runId, actionId: created.id, actor: "IntentGuard", parent: "Worker Agent", tool: toolName,
      action: `${evaluation.decision} — alignment ${evaluation.alignmentScore}%, risk ${evaluation.riskScore}`, authoritySource: "policy-engine",
    });
    return created;
  });

  let execution: Awaited<ReturnType<typeof executeAction>> | null = null;
  if (opts.autoExecute && evaluation.decision === "ALLOW") execution = await executeAction(action.id);
  return { actionId: action.id, sequence, toolName, evaluation, execution };
}

/** Independently verifies the stored decision before any tool runs. Never trusts the caller. */
export async function executeAction(actionId: string) {
  const action = await prisma.action.findUnique({ where: { id: actionId }, include: { approval: true } });
  if (!action) throw new ServiceError("Action not found.", 404, "NOT_FOUND");
  const run = await loadRun(action.runId);
  const guarded: GuardedAction = {
    id: action.id,
    runId: action.runId,
    sequence: action.sequence,
    toolName: action.toolName,
    arguments: parseJson(action.arguments, {}),
    status: action.status as ActionStatus,
    decision: action.decision as Decision | null,
    integrityHash: action.integrityHash,
  };
  const approval = action.approval ? { decision: action.approval.decision as "PENDING" | "APPROVED" | "DENIED", scope: action.approval.scope } : null;
  const ctx = { runId: action.runId, priorResults: priorResults({ ...run, actions: run.actions.filter((a) => a.sequence < action.sequence) }) };
  const outcome = await executeGuarded(guarded, approval, ctx);
  if (!outcome.executed) return { executed: false as const, reason: outcome.reason };

  await prisma.$transaction(async (tx) => {
    await tx.action.update({
      where: { id: actionId },
      data: { status: "EXECUTED", executedAt: new Date(), result: JSON.stringify(outcome.result.output), resultMeta: JSON.stringify(outcome.result.meta) },
    });
    await tx.actionReceipt.update({ where: { actionId }, data: { executed: true } });
    await recordProvenance(tx, {
      runId: action.runId, actionId, actor: `Tool: ${action.toolName}`, parent: "IntentGuard", tool: action.toolName,
      action: "Executed (simulated tool)", authoritySource: action.authoritySource,
    });
  });
  return { executed: true as const, output: outcome.result.output, meta: outcome.result.meta };
}

export async function decideApproval(actionId: string, decision: "APPROVED" | "DENIED", decidedBy = "user", note?: string) {
  const action = await prisma.action.findUnique({ where: { id: actionId }, include: { approval: true } });
  if (!action) throw new ServiceError("Action not found.", 404, "NOT_FOUND");
  if (action.decision !== "WARN" || !action.approval) throw new ServiceError("This action does not require approval.", 409, "NO_APPROVAL");
  if (action.approval.decision !== "PENDING") throw new ServiceError(`Approval already ${action.approval.decision.toLowerCase()}.`, 409, "ALREADY_DECIDED");

  await prisma.$transaction(async (tx) => {
    await tx.approval.update({ where: { actionId }, data: { decision, decidedBy, decidedAt: new Date(), note: note ?? null } });
    await tx.actionReceipt.update({ where: { actionId }, data: { approvalStatus: decision } });
    await recordProvenance(tx, {
      runId: action.runId, actionId, actor: decidedBy === "system" ? "System" : "User (human approver)", parent: "IntentGuard", tool: action.toolName,
      action: decision === "APPROVED" ? "Approved once (this action only)" : note ?? "Denied", authoritySource: decidedBy === "system" ? "timeout-policy" : "user",
    });
    await tx.agentRun.update({ where: { id: action.runId }, data: { status: "RUNNING" } });
  });

  const execution = decision === "APPROVED" ? await executeAction(actionId) : null;
  return { actionId, decision, execution };
}

// ── Read models ───────────────────────────────────────────────────────────

export async function getRunDetail(runId: string) {
  const exists = await prisma.agentRun.findUnique({ where: { id: runId }, select: { id: true, status: true } });
  if (!exists) throw new ServiceError("Run not found.", 404, "NOT_FOUND");
  if (exists.status === "WAITING_APPROVAL") await expireApprovals(await loadRun(runId));
  const run = await prisma.agentRun.findUnique({
    where: { id: runId },
    include: {
      intent: true,
      trajectory: true,
      actions: { orderBy: { sequence: "asc" }, include: { approval: true, violations: true, receipt: true, riskAssessment: true } },
      provenance: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!run) throw new ServiceError("Run not found.", 404, "NOT_FOUND");
  const intent = intentFromRow(run.intent);
  const state = intent ? buildTrajectoryState(run.actions.map(trajectoryEntryFromRow), intent) : null;
  return {
    id: run.id,
    mode: run.mode as RunMode,
    scenario: run.scenario,
    status: run.status,
    finalDecision: run.finalDecision as Decision | null,
    stepCount: run.stepCount,
    lastAgentNote: run.lastAgentNote,
    startedAt: run.startedAt.toISOString(),
    endedAt: run.endedAt?.toISOString() ?? null,
    intent: intentView(run.intent),
    intentIntact: intentIntact(run.intent),
    trajectory: {
      sequence: parseJson<{ tool: string; decision: string }[]>(run.trajectory?.sequence, []),
      patterns: parseJson<string[]>(run.trajectory?.patterns, []),
      patternLabels: parseJson<string[]>(run.trajectory?.patterns, []).map((p) => PATTERN_LABELS[p as TrajectoryPattern] ?? p),
      maxRisk: run.trajectory?.maxRisk ?? 0,
      untrustedInstructionsDetected: state?.untrustedInstructionsDetected ?? false,
      injectionSignals: state?.injectionSignals ?? [],
      sensitiveDataHeld: state?.sensitiveDataHeld ?? false,
    },
    actions: run.actions.map((a) => ({
      id: a.id,
      sequence: a.sequence,
      toolName: a.toolName,
      arguments: parseJson<Record<string, unknown>>(a.arguments, {}),
      reason: a.reason,
      status: a.status as ActionStatus,
      decision: a.decision as Decision | null,
      decisionReason: a.decisionReason,
      alignmentScore: a.alignmentScore,
      riskScore: a.riskScore,
      riskLevel: a.riskLevel,
      proposedBy: a.proposedBy,
      authoritySource: a.authoritySource,
      createdAt: a.createdAt.toISOString(),
      executedAt: a.executedAt?.toISOString() ?? null,
      result: parseJson<unknown>(a.result, null),
      resultMeta: parseJson<ResultMeta | null>(a.resultMeta, null),
      violations: a.violations.map((v) => ({ code: v.policyCode, message: v.message, severity: v.severity })),
      approval: a.approval ? { decision: a.approval.decision, decidedAt: a.approval.decidedAt?.toISOString() ?? null, note: a.approval.note } : null,
      receiptId: a.receipt?.receiptId ?? null,
      riskFactors: parseJson<{ label: string; points: number }[]>(a.riskAssessment?.factors, []),
      alignmentFactors: parseJson<{ alignmentFactors?: { label: string; points: number }[] }>(a.receipt?.payload, {}).alignmentFactors ?? [],
    })),
    provenance: run.provenance.map((p) => ({
      id: p.id, actor: p.actor, parent: p.parent, tool: p.tool, action: p.action, authoritySource: p.authoritySource, actionId: p.actionId, createdAt: p.createdAt.toISOString(),
    })),
  };
}
export type RunDetail = Awaited<ReturnType<typeof getRunDetail>>;

export async function computeStats() {
  const [activeRuns, actions, allowed, warned, blocked, agg, maxRisk, totalRuns] = await Promise.all([
    prisma.agentRun.count({ where: { status: { in: ["RUNNING", "WAITING_APPROVAL"] } } }),
    prisma.action.count(),
    prisma.action.count({ where: { decision: "ALLOW" } }),
    prisma.action.count({ where: { decision: "WARN" } }),
    prisma.action.count({ where: { decision: "BLOCK" } }),
    prisma.action.aggregate({ _avg: { alignmentScore: true } }),
    prisma.action.aggregate({ _max: { riskScore: true } }),
    prisma.agentRun.count(),
  ]);
  return {
    activeRuns,
    totalRuns,
    actionsEvaluated: actions,
    actionsAllowed: allowed,
    warnings: warned,
    blocked,
    averageAlignment: agg._avg.alignmentScore === null ? null : Math.round(agg._avg.alignmentScore),
    highestRisk: maxRisk._max.riskScore ?? null,
  };
}

export type { Prisma };
