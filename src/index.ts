// src/index.ts — Public API for using SLA as a Node.js library

export { RuleEngine } from "./engine/rule-engine.js";
export { ConfigLoader } from "./engine/config-loader.js";
export { createLLMClient } from "./engine/llm-provider.js";
export { FileScanner } from "./auditors/file-scanner.js";
export { StackScanner } from "./auditors/stack-scanner.js";
export { AutoFixer } from "./fixers/auto-fixer.js";
export { TerminalReporter } from "./reporters/terminal-reporter.js";
export { JsonReporter } from "./reporters/json-reporter.js";
export type {
  SLARule,
  SLARulesConfig,
  AuditReport,
  FileAuditResult,
  Violation,
  AuditOptions,
  LLMFixResponse,
  Severity,
  LLMProvider,
  RuleCategory,
  EnforcementLevel,
} from "./types.js";
