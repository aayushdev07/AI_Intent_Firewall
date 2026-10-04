/**
 * Shared domain types for IntentGuard.
 * The firewall modules in lib/firewall are pure functions over these types,
 * so the security logic can be unit-tested without a database or a model.
 */

export type RiskTolerance = "low" | "medium" | "high";
export type Decision = "ALLOW" | "WARN" | "BLOCK";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type ActionStatus = "PROPOSED" | "ALLOWED" | "WARNED" | "BLOCKED" | "EXECUTED";
export type RunStatus = "RUNNING" | "WAITING_APPROVAL" | "COMPLETED" | "HALTED" | "FAILED";
export type RunMode = "LIVE" | "DEMO" | "SCRIPTED";
export type ProposedBy = "LLM" | "SCRIPTED" | "DEMO" | "API";

export type IntentConstraint = {
  key: string;
  value: string | number | boolean;
  source: string;
};

export type OriginalIntent = {
  id: string;
  goal: string;
  /** Explicit facts/constraints grounded in the user's request. */
  constraints: IntentConstraint[];
  allowedResources: string[];
  expectedActions: string[];
  restrictedActions: string[];
  sensitiveDataAllowed: boolean;
  externalTransferAllowed: boolean;
  allowedDestinations?: string[];
  budgetLimit?: number;
  riskTolerance: RiskTolerance;
  createdAt: string;
  immutable: true;
  /** Ambiguities the parser could not resolve (never silently turned into authority). */
  ambiguities?: string[];
};

/** Intent draft before user confirmation (not yet immutable). */
export type IntentDraft = Omit<OriginalIntent, "id" | "createdAt" | "immutable" | "constraints"> & {
  constraints?: IntentConstraint[];
  ambiguities: string[];
};

export type DataClassification = "INTERNAL" | "SENSITIVE" | "UNTRUSTED" | "DERIVED" | "TRANSFER" | "COMMUNICATION" | "PUBLIC" | "FINANCIAL";
export type ExternalImpact = "NONE" | "LOW" | "MEDIUM" | "HIGH";
export type ToolCategory = "READ" | "COMPUTE" | "CREATE" | "TRANSFER" | "COMMIT";

export type ToolParam = {
  name: string;
  type: "string" | "number" | "boolean";
  required: boolean;
  description: string;
  enum?: string[];
  /** True when the value names data (a file, source or record set) rather than free prose. */
  dataRef?: boolean;
};

export type ToolMetadata = {
  name: string;
  description: string;
  category: ToolCategory;
  /** Data resource this tool reads, if any (matched against intent.allowedResources). */
  resource?: string;
  dataClassification: DataClassification;
  externalImpact: ExternalImpact;
  requiresExplicitAuthorization: boolean;
  riskWeight: number;
  potentialExfiltration: boolean;
  /** Argument that names an external destination (for transfer tools). */
  destinationArg?: string;
  /** Spends money or makes a binding commitment (bookings, purchases). Governed by R11/B2. */
  financial?: boolean;
  /** Argument holding the id of a verified offer (from an earlier search result in this run). */
  offerArg?: string;
  params: ToolParam[];
};

export type ActionProposal = {
  toolName: string;
  arguments: Record<string, unknown>;
  reason: string;
};

/** Security-relevant facts about a tool result, computed by the backend. */
export type ResultMeta = {
  containsSensitive?: boolean;
  untrusted?: boolean;
  injectionDetected?: boolean;
  injectionSignals?: string[];
  producedFile?: { filename: string; tainted: boolean; sources: string[] };
  /** Bookable offers returned by a search tool. Prices are recorded by the backend, never taken from the agent. */
  offers?: { id: string; price: number; currency: string; label: string }[];
  /** True when the tool had a real-world effect (e.g. a real email was sent). */
  realWorld?: boolean;
};

/** A past action as the firewall sees it when evaluating the trajectory. */
export type TrajectoryEntry = {
  actionId: string;
  sequence: number;
  toolName: string;
  arguments: Record<string, unknown>;
  status: ActionStatus;
  decision?: Decision;
  alignmentScore?: number;
  riskScore?: number;
  approval?: "PENDING" | "APPROVED" | "DENIED";
  resultMeta?: ResultMeta;
};

export type ScoreFactor = { label: string; points: number };

export type Violation = {
  code: string;
  severity: "HARD" | "SOFT" | "ESCALATE";
  message: string;
};

export type SecuritySettings = {
  requireApprovalForMedium: boolean;
  blockUnauthorizedExternalTransfer: boolean;
  blockSensitiveExfiltration: boolean;
  treatExternalContentUntrusted: boolean;
  failClosed: boolean;
};

export type RiskThresholds = {
  /** Scores >= mediumMin are MEDIUM (default 30). */
  mediumMin: number;
  /** Scores >= highMin are HIGH (default 70). */
  highMin: number;
};

export type FirewallConfig = {
  thresholds: RiskThresholds;
  security: SecuritySettings;
};

export type Evaluation = {
  decision: Decision;
  alignmentScore: number;
  riskScore: number;
  riskLevel: RiskLevel;
  violations: string[];
  reason: string;
  /** Extended, fully deterministic evaluation record. */
  details: {
    violations: Violation[];
    alignmentFactors: ScoreFactor[];
    riskFactors: ScoreFactor[];
    patterns: string[];
    evaluationSteps: { step: string; ok: boolean; note?: string }[];
    effectiveThresholds: RiskThresholds;
    failSafe: boolean;
  };
};

export type AppSettings = {
  lmStudioBaseUrl: string;
  lmStudioModel: string;
  thresholds: RiskThresholds;
  security: SecuritySettings;
  demo: { demoMode: boolean; promptInjectionScenario: boolean };
  experience: ExperienceSettings;
};

/** How the chat experience behaves. None of these weaken a security decision. */
export type ExperienceSettings = {
  /** Reveal the technical layer: scores, trajectories, simulations, policies. */
  showWorking: boolean;
  /** Always ask the user to confirm the understood request. When off, confirmation is still
   *  required whenever the request authorizes external transfer or sensitive data, or is ambiguous. */
  alwaysConfirm: boolean;
};

export const DEFAULT_EXPERIENCE: ExperienceSettings = { showWorking: false, alwaysConfirm: false };

export const DEFAULT_THRESHOLDS: RiskThresholds = { mediumMin: 30, highMin: 70 };

export const DEFAULT_SECURITY: SecuritySettings = {
  requireApprovalForMedium: true,
  blockUnauthorizedExternalTransfer: true,
  blockSensitiveExfiltration: true,
  treatExternalContentUntrusted: true,
  failClosed: true,
};
