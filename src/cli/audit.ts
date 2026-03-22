#!/usr/bin/env node
// src/cli/audit.ts — `sla audit` entry point

import { Command } from "commander";
import * as path from "path";
import type { AuditOptions, Severity, RuleCategory } from "../types.js";
import { ConfigLoader } from "../engine/config-loader.js";
import { RuleEngine } from "../engine/rule-engine.js";
import { FileScanner } from "../auditors/file-scanner.js";
import { TerminalReporter } from "../reporters/terminal-reporter.js";
import { JsonReporter } from "../reporters/json-reporter.js";

const program = new Command();

program
  .name("sla audit")
  .description("Audit source files against SLA architectural rules")
  .option("-f, --files <paths...>", "Specific files to audit")
  .option(
    "--files-from <path>",
    "Path to a text file listing files to audit (one per line)"
  )
  .option("--fix", "Automatically fix violations using deterministic and LLM-based fixers")
  .option("--dry-run", "Show what fixes would be applied without writing to disk")
  .option(
    "-r, --rules <path>",
    "Path to rules YAML file",
    ".sla/rules.yaml"
  )
  .option(
    "-s, --severity <level>",
    "Only report violations at or above this severity (LOW|MEDIUM|HIGH|CRITICAL)"
  )
  .option(
    "-c, --category <name>",
    "Only report violations in this category"
  )
  .option("--json", "Output results as JSON (for CI piping)")
  .option("-o, --output <path>", "Write JSON report to this file path")
  .option(
    "-p, --provider <name>",
    "LLM provider override (anthropic|openai|gemini)"
  )
  .option("-m, --model <name>", "LLM model override")
  .option("-v, --verbose", "Show passing files and extended details")
  .option("--ci", "CI mode: exit with code 1 if any violations found (even after fixing)")
  .action(async (opts) => {
    const options: AuditOptions = {
      files: opts.files,
      filesFrom: opts.filesFrom,
      fix: opts.fix,
      dryRun: opts.dryRun,
      rulesPath: opts.rules,
      severity: opts.severity as Severity | undefined,
      category: opts.category as RuleCategory | undefined,
      json: opts.json,
      outputPath: opts.output,
      provider: opts.provider,
      model: opts.model,
      verbose: opts.verbose,
      ci: opts.ci,
    };

    try {
      // Load config
      const config = ConfigLoader.load(options.rulesPath ?? ".sla/rules.yaml");

      // Apply CLI overrides
      if (options.provider) config.llmProvider = options.provider;
      if (options.model) config.llmModel = options.model;

      const engine = new RuleEngine(config);
      const scanner = new FileScanner(engine, config);
      const report = await scanner.audit(options);

      // Output
      if (options.json) {
        const reporter = new JsonReporter();
        if (options.outputPath) {
          reporter.write(report, options.outputPath);
          console.error(`[SLA] Report written to ${options.outputPath}`);
        } else {
          reporter.print(report);
        }
      } else {
        const reporter = new TerminalReporter(options.verbose);
        reporter.printReport(report);
      }

      // Exit code logic
      const hasUnresolvedViolations = report.failedFiles > 0;
      if (hasUnresolvedViolations || (options.ci && report.totalViolations > 0)) {
        process.exit(1);
      }
    } catch (err) {
      console.error(`\n[SLA] Error: ${(err as Error).message}\n`);
      process.exit(2);
    }
  });

program.parse(process.argv);
