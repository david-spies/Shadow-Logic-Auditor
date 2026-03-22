// src/auditors/file-scanner.ts — File discovery and batch auditing coordinator

import * as fs from "fs";
import * as path from "path";
import fastGlob from "fast-glob";
import ignore from "ignore";
import type {
  AuditReport,
  FileAuditResult,
  AuditOptions,
  SLARulesConfig,
} from "../types.js";
import { RuleEngine } from "../engine/rule-engine.js";
import { AutoFixer } from "../fixers/auto-fixer.js";

const SUPPORTED_EXTENSIONS = [
  "ts", "tsx", "js", "jsx", "mts", "cts",
  "py", "rb", "go", "rs", "java", "cs",
  "sql", "yaml", "yml", "json",
];

export class FileScanner {
  private engine: RuleEngine;
  private config: SLARulesConfig;
  private ig: ReturnType<typeof ignore>;

  constructor(engine: RuleEngine, config: SLARulesConfig) {
    this.engine = engine;
    this.config = config;
    this.ig = ignore();

    // Respect .gitignore if present
    const gitignorePath = path.join(process.cwd(), ".gitignore");
    if (fs.existsSync(gitignorePath)) {
      this.ig.add(fs.readFileSync(gitignorePath, "utf8"));
    }

    // Apply patterns from config
    if (config.ignorePatterns?.length) {
      this.ig.add(config.ignorePatterns);
    }

    // Always ignore node_modules and dist
    this.ig.add(["node_modules/**", "dist/**", ".git/**", "*.min.js"]);
  }

  /**
   * Resolves file list from CLI options.
   */
  async resolveFiles(opts: AuditOptions): Promise<string[]> {
    if (opts.filesFrom) {
      const raw = fs.readFileSync(opts.filesFrom, "utf8");
      return raw
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .filter((f) => fs.existsSync(f));
    }

    if (opts.files?.length) {
      return opts.files.filter((f) => fs.existsSync(f));
    }

    // Default: scan all supported files in cwd
    const patterns = SUPPORTED_EXTENSIONS.map((ext) => `**/*.${ext}`);
    const all = await fastGlob(patterns, {
      cwd: process.cwd(),
      absolute: true,
      dot: false,
    });

    return all.filter((f) => {
      const relative = path.relative(process.cwd(), f);
      return !this.ig.ignores(relative);
    });
  }

  /**
   * Run a full audit across all resolved files.
   */
  async audit(opts: AuditOptions): Promise<AuditReport> {
    const startTime = Date.now();
    const files = await this.resolveFiles(opts);
    const results: FileAuditResult[] = [];

    const fixer = opts.fix
      ? new AutoFixer(this.engine, this.config, {
          dryRun: opts.dryRun,
          templatesDir: path.join(path.dirname(opts.rulesPath ?? ".sla/rules.yaml"), "templates"),
          verbose: opts.verbose,
        })
      : null;

    for (const file of files) {
      let content: string;
      try {
        content = fs.readFileSync(file, "utf8");
      } catch {
        continue; // Skip unreadable files
      }

      const fileStart = Date.now();
      let result = this.engine.auditContent(content, file, fileStart);

      // Apply category/severity filters
      if (opts.severity) {
        result = {
          ...result,
          violations: result.violations.filter(
            (v) => v.severity === opts.severity
          ),
        };
      }
      if (opts.category) {
        result = {
          ...result,
          violations: result.violations.filter(
            (v) => v.category === opts.category
          ),
        };
      }

      // Re-derive status after filtering
      if (result.violations.length === 0) result.status = "pass";

      // Attempt fixes
      if (fixer && result.violations.some((v) => v.autoFixAvailable)) {
        result = await fixer.fix(result);
      }

      results.push(result);
    }

    return this.buildReport(results, startTime);
  }

  private buildReport(results: FileAuditResult[], startTime: number): AuditReport {
    const failed = results.filter((r) => r.status === "fail");
    const fixed = results.filter((r) => r.status === "fixed");
    const passed = results.filter((r) => r.status === "pass" || r.status === "warn");

    const allViolations = results.flatMap((r) => r.violations);

    return {
      projectName: this.engine.projectName,
      timestamp: new Date().toISOString(),
      totalFiles: results.length,
      passedFiles: passed.length,
      failedFiles: failed.length,
      fixedFiles: fixed.length,
      totalViolations: allViolations.length,
      criticalCount: allViolations.filter((v) => v.severity === "CRITICAL").length,
      highCount: allViolations.filter((v) => v.severity === "HIGH").length,
      mediumCount: allViolations.filter((v) => v.severity === "MEDIUM").length,
      lowCount: allViolations.filter((v) => v.severity === "LOW").length,
      results,
      durationMs: Date.now() - startTime,
    };
  }
}
