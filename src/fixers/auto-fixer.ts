// src/fixers/auto-fixer.ts — Orchestrates deterministic and LLM-based fixes

import * as fs from "fs";
import * as path from "path";
import type {
  FileAuditResult,
  SLARulesConfig,
  Violation,
  LLMFixResponse,
} from "../types.js";
import { RuleEngine } from "../engine/rule-engine.js";
import { createLLMClient } from "../engine/llm-provider.js";

export interface FixerOptions {
  dryRun?: boolean;
  templatesDir?: string;
  verbose?: boolean;
}

export class AutoFixer {
  private engine: RuleEngine;
  private config: SLARulesConfig;
  private opts: FixerOptions;

  constructor(engine: RuleEngine, config: SLARulesConfig, opts: FixerOptions = {}) {
    this.engine = engine;
    this.config = config;
    this.opts = opts;
  }

  /**
   * Attempt to fix all violations in a FileAuditResult.
   * Applies deterministic fixes first, then LLM fixes for what remains.
   */
  async fix(result: FileAuditResult): Promise<FileAuditResult> {
    if (result.violations.length === 0) return result;

    let content = result.originalContent ?? "";
    let fixesApplied = 0;

    // ── Pass 1: Deterministic fixes (no LLM required) ──────────────────────
    const remainingViolations: Violation[] = [];

    for (const violation of result.violations) {
      const rule = this.engine.getRuleById(violation.ruleId);
      if (!rule?.autoFix?.replace) {
        remainingViolations.push(violation);
        continue;
      }

      const fixed = this.engine.applyDeterministicFix(content, rule);
      if (fixed !== null) {
        content = fixed;
        fixesApplied++;
        if (this.opts.verbose) {
          console.log(`  ✓ Deterministic fix applied: ${rule.id}`);
        }
      } else {
        remainingViolations.push(violation);
      }
    }

    // ── Pass 2: LLM fixes for remaining violations ─────────────────────────
    const llmFixable = remainingViolations.filter((v) => v.autoFixAvailable);

    if (llmFixable.length > 0 && this.config.llmProvider) {
      try {
        const llmResult = await this.applyLLMFix(
          content,
          result.filePath,
          llmFixable
        );
        content = llmResult.fixedCode;
        fixesApplied += llmResult.violationsAddressed.length;

        if (this.opts.verbose) {
          console.log(
            `  ✓ LLM fix applied (confidence: ${Math.round(llmResult.confidence * 100)}%): ${llmResult.violationsAddressed.join(", ")}`
          );
          console.log(`  → ${llmResult.explanation}`);
        }
      } catch (err) {
        console.warn(`  ⚠ LLM fix failed for ${result.filePath}: ${err}`);
      }
    }

    // ── Write to disk if not dry run ────────────────────────────────────────
    if (!this.opts.dryRun && content !== result.originalContent) {
      fs.writeFileSync(result.filePath, content, "utf8");
    }

    // ── Re-audit to verify fixes actually resolved violations ───────────────
    const reAuditResult = this.engine.auditContent(
      content,
      result.filePath,
      Date.now()
    );

    return {
      ...reAuditResult,
      fixesApplied,
      originalContent: result.originalContent,
      fixedContent: content !== result.originalContent ? content : undefined,
      status: reAuditResult.violations.length === 0 ? "fixed" : reAuditResult.status,
    };
  }

  private async applyLLMFix(
    content: string,
    filePath: string,
    violations: Violation[]
  ): Promise<LLMFixResponse> {
    const provider = this.config.llmProvider!;
    const client = createLLMClient(provider, this.config.llmModel);

    // Load template if available (use the first violation's templateRef)
    let templateContent: string | undefined;
    const firstViolation = violations[0];
    const rule = this.engine.getRuleById(firstViolation.ruleId);
    const templateRef = rule?.autoFix?.templateRef;

    if (templateRef && this.opts.templatesDir) {
      const templatePath = path.join(
        this.opts.templatesDir,
        `${templateRef}.md`
      );
      if (fs.existsSync(templatePath)) {
        templateContent = fs.readFileSync(templatePath, "utf8");
      }
    }

    return await client.requestFix(content, filePath, violations, templateContent);
  }
}
