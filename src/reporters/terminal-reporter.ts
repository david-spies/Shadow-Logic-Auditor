// src/reporters/terminal-reporter.ts — Rich terminal output for audit results

import chalk from "chalk";
import type { AuditReport, FileAuditResult, Violation, Severity } from "../types.js";

const SEVERITY_COLORS: Record<Severity, chalk.Chalk> = {
  CRITICAL: chalk.bgRed.white.bold,
  HIGH: chalk.red.bold,
  MEDIUM: chalk.yellow.bold,
  LOW: chalk.cyan,
};

const SEVERITY_ICONS: Record<Severity, string> = {
  CRITICAL: "🔴",
  HIGH: "🟠",
  MEDIUM: "🟡",
  LOW: "🔵",
};

const STATUS_ICONS = {
  pass: chalk.green("✓"),
  warn: chalk.yellow("⚠"),
  fail: chalk.red("✗"),
  fixed: chalk.cyan("⚡"),
};

export class TerminalReporter {
  private verbose: boolean;

  constructor(verbose = false) {
    this.verbose = verbose;
  }

  printReport(report: AuditReport): void {
    this.printHeader(report);

    const failedOrFixed = report.results.filter(
      (r) => r.status === "fail" || r.status === "fixed" || r.status === "warn"
    );

    if (failedOrFixed.length > 0) {
      console.log(chalk.bold("\n📋 Violations:\n"));
      for (const result of failedOrFixed) {
        this.printFileResult(result);
      }
    } else if (this.verbose) {
      console.log(chalk.green("\n✅ All files passed architectural audit.\n"));
    }

    this.printSummary(report);
  }

  private printHeader(report: AuditReport): void {
    const line = "─".repeat(60);
    console.log(chalk.bold.cyan(`\n╔═══════════════════════════════════════╗`));
    console.log(chalk.bold.cyan(`║    Shadow-Logic Auditor  v2.0         ║`));
    console.log(chalk.bold.cyan(`╚═══════════════════════════════════════╝\n`));
    console.log(
      `  ${chalk.bold("Project:")} ${report.projectName}  ${chalk.dim(`· ${report.timestamp}`)}`
    );
    console.log(`  ${chalk.bold("Files scanned:")} ${report.totalFiles}`);
    console.log(chalk.dim(`  ${line}`));
  }

  private printFileResult(result: FileAuditResult): void {
    const icon = STATUS_ICONS[result.status];
    const relPath = result.filePath.replace(process.cwd() + "/", "");
    const fixBadge =
      result.fixesApplied > 0
        ? chalk.cyan(` [${result.fixesApplied} fix${result.fixesApplied > 1 ? "es" : ""} applied]`)
        : "";

    console.log(`  ${icon} ${chalk.bold(relPath)}${fixBadge}`);

    for (const violation of result.violations) {
      this.printViolation(violation);
    }

    if (result.fixedContent && this.verbose) {
      console.log(
        chalk.dim(`\n  ── Fixed diff preview ──────────────────────`)
      );
    }

    console.log("");
  }

  private printViolation(v: Violation): void {
    const severityLabel = SEVERITY_COLORS[v.severity](
      ` ${v.severity} `
    );
    const icon = SEVERITY_ICONS[v.severity];

    console.log(
      `    ${icon} ${severityLabel} ${chalk.bold(`[${v.ruleId}]`)} ${v.ruleName}`
    );
    console.log(
      `       ${chalk.dim(`Line ${v.location.line}:`)} ${chalk.italic(v.location.snippet)}`
    );
    console.log(`       ${chalk.white("→")} ${v.requirement}`);

    if (v.advice) {
      console.log(`       ${chalk.dim("💡")} ${chalk.dim(v.advice)}`);
    }

    if (v.autoFixAvailable) {
      console.log(
        `       ${chalk.cyan("⚡")} ${chalk.dim("Auto-fix available. Run with --fix to apply.")}`
      );
    }
  }

  private printSummary(report: AuditReport): void {
    const line = "─".repeat(60);
    console.log(chalk.dim(`  ${line}`));
    console.log(chalk.bold("\n  Summary:\n"));

    const rows = [
      ["Files", `${report.totalFiles}`, ""],
      ["Passed", `${report.passedFiles}`, chalk.green("✓")],
      ["Failed", `${report.failedFiles}`, report.failedFiles > 0 ? chalk.red("✗") : ""],
      ["Auto-Fixed", `${report.fixedFiles}`, report.fixedFiles > 0 ? chalk.cyan("⚡") : ""],
    ];

    for (const [label, value, icon] of rows) {
      console.log(
        `  ${chalk.dim(label.padEnd(12))} ${chalk.bold(value.padStart(4))}  ${icon}`
      );
    }

    console.log("");

    if (report.totalViolations > 0) {
      console.log(`  ${chalk.bold("Violations by severity:")}`);
      if (report.criticalCount > 0)
        console.log(
          `    ${SEVERITY_ICONS.CRITICAL} CRITICAL: ${chalk.red.bold(report.criticalCount)}`
        );
      if (report.highCount > 0)
        console.log(
          `    ${SEVERITY_ICONS.HIGH} HIGH:     ${chalk.red(report.highCount)}`
        );
      if (report.mediumCount > 0)
        console.log(
          `    ${SEVERITY_ICONS.MEDIUM} MEDIUM:   ${chalk.yellow(report.mediumCount)}`
        );
      if (report.lowCount > 0)
        console.log(
          `    ${SEVERITY_ICONS.LOW} LOW:      ${chalk.cyan(report.lowCount)}`
        );
      console.log("");
    }

    console.log(
      chalk.dim(`  Completed in ${(report.durationMs / 1000).toFixed(2)}s\n`)
    );

    if (report.failedFiles > 0) {
      console.log(
        chalk.red.bold(
          "  ❌ Audit FAILED — architectural violations must be resolved.\n"
        )
      );
    } else if (report.fixedFiles > 0) {
      console.log(
        chalk.cyan.bold(
          "  ⚡ Audit FIXED — violations auto-corrected and committed.\n"
        )
      );
    } else {
      console.log(
        chalk.green.bold("  ✅ Audit PASSED — codebase is architecturally compliant.\n")
      );
    }
  }

  printSpinner(message: string): void {
    process.stdout.write(`  ${chalk.dim("…")} ${message}\r`);
  }

  clearLine(): void {
    process.stdout.write("\r\x1b[K");
  }
}
