// src/engine/rule-engine.ts — Pattern matching engine with multi-pass analysis

import * as fs from "fs";
import * as path from "path";
import micromatch from "micromatch";
import type {
  SLARule,
  SLARulesConfig,
  Violation,
  ViolationLocation,
  FileAuditResult,
  AuditStatus,
} from "../types.js";

export class RuleEngine {
  private rules: SLARule[];
  private config: SLARulesConfig;

  constructor(config: SLARulesConfig) {
    this.config = config;
    this.rules = config.constraints.filter((r) => r.enabled !== false);
  }

  /**
   * Audits a single file's content against all applicable rules.
   * Returns structured violations with location metadata.
   */
  auditContent(
    content: string,
    filePath: string,
    startTime: number
  ): FileAuditResult {
    const normalizedPath = filePath.replace(/\\/g, "/");
    const violations: Violation[] = [];

    for (const rule of this.rules) {
      // Skip if rule has a scope and this file doesn't match
      if (rule.pattern.scope) {
        const matches = micromatch([normalizedPath], [rule.pattern.scope]);
        if (matches.length === 0) continue;
      }

      if (!rule.pattern.regex) continue;

      let regex: RegExp;
      try {
        regex = new RegExp(rule.pattern.regex, "gm");
      } catch {
        console.warn(
          `[SLA] Invalid regex in rule ${rule.id}: ${rule.pattern.regex}`
        );
        continue;
      }

      const lines = content.split("\n");
      let match: RegExpExecArray | null;

      while ((match = regex.exec(content)) !== null) {
        const location = this.resolveLocation(content, lines, match);

        violations.push({
          ruleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          category: rule.category,
          message: `Rule ${rule.id}: ${rule.name}`,
          requirement: rule.requirement,
          advice: rule.advice,
          location,
          autoFixAvailable:
            rule.autoFix !== undefined &&
            (rule.autoFix.replace !== undefined ||
              rule.autoFix.templateRef !== undefined ||
              rule.autoFix.useLLM === true),
        });

        // Avoid infinite loops on zero-length matches
        if (match.index === regex.lastIndex) regex.lastIndex++;
      }
    }

    const status = this.deriveStatus(violations);
    const durationMs = Date.now() - startTime;

    return {
      filePath,
      status,
      violations,
      fixesApplied: 0,
      originalContent: content,
      auditDurationMs: durationMs,
    };
  }

  /**
   * Returns only the rules that apply to a given file path.
   */
  getApplicableRules(filePath: string): SLARule[] {
    const normalizedPath = filePath.replace(/\\/g, "/");
    return this.rules.filter((rule) => {
      if (!rule.pattern.scope) return true;
      return micromatch([normalizedPath], [rule.pattern.scope]).length > 0;
    });
  }

  /**
   * Returns a specific rule by ID.
   */
  getRuleById(id: string): SLARule | undefined {
    return this.rules.find((r) => r.id === id);
  }

  /**
   * Applies a simple deterministic auto-fix (replace pattern).
   * Returns the fixed content if a fix was applied, otherwise null.
   */
  applyDeterministicFix(content: string, rule: SLARule): string | null {
    if (!rule.autoFix?.replace || !rule.pattern.regex) return null;

    try {
      const regex = new RegExp(rule.pattern.regex, "gm");
      const fixed = content.replace(regex, rule.autoFix.replace);
      return fixed !== content ? fixed : null;
    } catch {
      return null;
    }
  }

  /**
   * Resolve line/column numbers from a regex match.
   */
  private resolveLocation(
    content: string,
    lines: string[],
    match: RegExpExecArray
  ): ViolationLocation {
    const before = content.slice(0, match.index);
    const lineNumber = (before.match(/\n/g) || []).length + 1;
    const lastNewline = before.lastIndexOf("\n");
    const column = match.index - (lastNewline === -1 ? 0 : lastNewline + 1);

    const snippet = lines[lineNumber - 1]?.trim() ?? match[0];

    return {
      line: lineNumber,
      column,
      snippet,
    };
  }

  /**
   * Derive an overall audit status from violations.
   */
  private deriveStatus(violations: Violation[]): AuditStatus {
    if (violations.length === 0) return "pass";
    const enforcement = this.config.enforcementLevel;
    if (enforcement === "warn") return "warn";
    return "fail";
  }

  /**
   * Check whether the config has any LLM-capable auto-fix rules.
   */
  hasLLMFixes(): boolean {
    return this.rules.some(
      (r) => r.autoFix?.useLLM === true || r.autoFix?.templateRef !== undefined
    );
  }

  get projectName(): string {
    return this.config.project;
  }

  get enforcementLevel() {
    return this.config.enforcementLevel;
  }

  get allRules(): SLARule[] {
    return this.rules;
  }
}
