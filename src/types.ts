// src/types.ts — Central type definitions for the Shadow-Logic Auditor

export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type EnforcementLevel = "warn" | "block" | "auto-fix";
export type LLMProvider = "anthropic" | "openai" | "gemini";
export type AuditStatus = "pass" | "warn" | "fail" | "fixed";
export type RuleCategory =
  | "security"
  | "architecture"
  | "performance"
  | "finops"
  | "style"
  | "data"
  | "custom";

// ─── Rule Definitions ────────────────────────────────────────────────────────

export interface RulePattern {
  /** Regex string to match violations */
  regex?: string;
  /** Glob pattern limiting which files this rule applies to */
  scope?: string;
  /** Optional AST node type for future tree-sitter support */
  astNode?: string;
}

export interface AutoFix {
  /** Simple string replacement (when the fix is deterministic) */
  replace?: string;
  /** Reference to a prompt template file in .sla/templates/ */
  templateRef?: string;
  /** Whether to use the LLM to perform the fix */
  useLLM?: boolean;
}

export interface SLARule {
  id: string;
  name: string;
  description?: string;
  category: RuleCategory;
  severity: Severity;
  pattern: RulePattern;
  requirement: string;
  advice?: string;
  autoFix?: AutoFix;
  /** Tags for filtering rules during partial audits */
  tags?: string[];
  /** Whether this rule is currently active */
  enabled?: boolean;
}

// ─── Rules Config ─────────────────────────────────────────────────────────────

export interface SLARulesConfig {
  version: string;
  project: string;
  description?: string;
  enforcementLevel: EnforcementLevel;
  llmProvider?: LLMProvider;
  llmModel?: string;
  ignorePatterns?: string[];
  constraints: SLARule[];
}

// ─── Audit Results ────────────────────────────────────────────────────────────

export interface ViolationLocation {
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  snippet: string;
}

export interface Violation {
  ruleId: string;
  ruleName: string;
  severity: Severity;
  category: RuleCategory;
  message: string;
  requirement: string;
  advice?: string;
  location: ViolationLocation;
  autoFixAvailable: boolean;
}

export interface FileAuditResult {
  filePath: string;
  status: AuditStatus;
  violations: Violation[];
  fixesApplied: number;
  originalContent?: string;
  fixedContent?: string;
  auditDurationMs: number;
}

export interface AuditReport {
  projectName: string;
  timestamp: string;
  totalFiles: number;
  passedFiles: number;
  failedFiles: number;
  fixedFiles: number;
  totalViolations: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  results: FileAuditResult[];
  durationMs: number;
}

// ─── LLM Response ────────────────────────────────────────────────────────────

export interface LLMFixResponse {
  fixedCode: string;
  explanation: string;
  confidence: number; // 0-1
  violationsAddressed: string[];
}

// ─── CLI Options ──────────────────────────────────────────────────────────────

export interface AuditOptions {
  files?: string[];
  filesFrom?: string;
  fix?: boolean;
  dryRun?: boolean;
  rulesPath?: string;
  severity?: Severity;
  category?: RuleCategory;
  json?: boolean;
  outputPath?: string;
  provider?: LLMProvider;
  model?: string;
  verbose?: boolean;
  ci?: boolean;
}

export interface InitOptions {
  force?: boolean;
  minimal?: boolean;
  provider?: LLMProvider;
}

// ─── Template System ─────────────────────────────────────────────────────────

export interface PromptTemplate {
  id: string;
  name: string;
  role: string;
  context: string;
  task: string;
  constraints: string[];
  examples?: Array<{ input: string; output: string }>;
}

// ─── Scanner Detection ────────────────────────────────────────────────────────

export interface StackDetectionResult {
  hasNextJs: boolean;
  hasSupabase: boolean;
  hasPrisma: boolean;
  hasDrizzle: boolean;
  hasAWS: boolean;
  hasReact: boolean;
  hasTRPC: boolean;
  hasTailwind: boolean;
  hasZod: boolean;
  hasVitest: boolean;
  hasDocker: boolean;
  projectName: string;
}
