#!/usr/bin/env node
// src/cli/index.ts — Top-level `sla` command dispatcher

import { Command } from "commander";
import chalk from "chalk";

const program = new Command();

program
  .name("sla")
  .description("Shadow-Logic Auditor — AI-driven technical debt prevention")
  .version("2.0.0");

program
  .command("init", "Scan your project and generate .sla/rules.yaml", {
    executableFile: "init",
  })
  .alias("i");

program
  .command("audit", "Audit source files against architectural rules", {
    executableFile: "audit",
  })
  .alias("a");

program
  .command("rules")
  .description("List all active rules from the current config")
  .option("-r, --rules <path>", "Path to rules YAML file", ".sla/rules.yaml")
  .action(async (opts) => {
    const { ConfigLoader } = await import("../engine/config-loader.js");
    const { RuleEngine } = await import("../engine/rule-engine.js");

    try {
      const config = ConfigLoader.load(opts.rules);
      const engine = new RuleEngine(config);

      console.log(
        chalk.bold.cyan(`\n  ${config.project} — Active Rules (${engine.allRules.length})\n`)
      );

      const byCategory = new Map<string, typeof engine.allRules>();
      for (const rule of engine.allRules) {
        const list = byCategory.get(rule.category) ?? [];
        list.push(rule);
        byCategory.set(rule.category, list);
      }

      for (const [cat, rules] of byCategory.entries()) {
        console.log(chalk.bold(`  ${cat.toUpperCase()}`));
        for (const r of rules) {
          const fix = r.autoFix
            ? chalk.cyan(" [auto-fix]")
            : "";
          const sev: Record<string, (s: string) => string> = {
            CRITICAL: chalk.red.bold,
            HIGH: chalk.red,
            MEDIUM: chalk.yellow,
            LOW: chalk.cyan,
          };
          console.log(
            `    ${sev[r.severity]?.(r.severity.padEnd(8)) ?? r.severity}  ${chalk.bold(r.id.padEnd(12))}  ${r.name}${fix}`
          );
        }
        console.log("");
      }
    } catch (err) {
      console.error(chalk.red(`\n  Error: ${(err as Error).message}\n`));
      process.exit(1);
    }
  });

program.parse(process.argv);
