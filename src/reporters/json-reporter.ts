// src/reporters/json-reporter.ts — Machine-readable JSON output for CI pipelines

import * as fs from "fs";
import type { AuditReport } from "../types.js";

export class JsonReporter {
  /**
   * Serialize a full audit report to a JSON string.
   */
  serialize(report: AuditReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Write the report to a file path.
   */
  write(report: AuditReport, outputPath: string): void {
    fs.writeFileSync(outputPath, this.serialize(report), "utf8");
  }

  /**
   * Print to stdout (for use in CI piping).
   */
  print(report: AuditReport): void {
    process.stdout.write(this.serialize(report) + "\n");
  }

  /**
   * Generate a compact CI-friendly summary for GitHub Actions annotation.
   */
  ciSummary(report: AuditReport): string {
    const lines: string[] = [];
    lines.push(`### SLA Audit Report — ${report.projectName}`);
    lines.push(`**Status**: ${report.failedFiles > 0 ? "❌ FAILED" : "✅ PASSED"}`);
    lines.push(
      `**Files**: ${report.totalFiles} scanned · ${report.passedFiles} passed · ${report.failedFiles} failed · ${report.fixedFiles} auto-fixed`
    );

    if (report.totalViolations > 0) {
      lines.push(`\n**Violations**: ${report.totalViolations} total`);
      if (report.criticalCount > 0)
        lines.push(`- 🔴 CRITICAL: ${report.criticalCount}`);
      if (report.highCount > 0) lines.push(`- 🟠 HIGH: ${report.highCount}`);
      if (report.mediumCount > 0)
        lines.push(`- 🟡 MEDIUM: ${report.mediumCount}`);
      if (report.lowCount > 0) lines.push(`- 🔵 LOW: ${report.lowCount}`);
    }

    for (const result of report.results.filter((r) => r.violations.length > 0)) {
      lines.push(`\n**\`${result.filePath}\`**`);
      for (const v of result.violations) {
        lines.push(
          `- \`[${v.ruleId}]\` **${v.ruleName}** (${v.severity}) — Line ${v.location.line}`
        );
        lines.push(`  > ${v.requirement}`);
      }
    }

    return lines.join("\n");
  }
}
