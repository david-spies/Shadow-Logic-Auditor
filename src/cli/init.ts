#!/usr/bin/env node
// src/cli/init.ts — `sla init` entry point — stack scanner and config generator

import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { StackScanner } from "../auditors/stack-scanner.js";
import { ConfigLoader } from "../engine/config-loader.js";
import type { InitOptions } from "../types.js";

const program = new Command();

program
  .name("sla init")
  .description(
    "Scan your project and generate an SLA rules config tailored to your stack"
  )
  .option("--force", "Overwrite existing .sla/rules.yaml if present")
  .option(
    "--minimal",
    "Generate a minimal config with only universal security rules"
  )
  .option(
    "-p, --provider <name>",
    "LLM provider for auto-fix (anthropic|openai|gemini)",
    "anthropic"
  )
  .action(async (opts: InitOptions) => {
    const outputPath = path.join(process.cwd(), ".sla", "rules.yaml");

    console.log(
      chalk.bold.cyan("\n  🔍 Shadow-Logic Auditor — Project Scanner\n")
    );

    // Guard against overwriting existing config
    if (fs.existsSync(outputPath) && !opts.force) {
      console.log(
        chalk.yellow(
          `  ⚠  ${outputPath} already exists. Use --force to overwrite.\n`
        )
      );
      process.exit(0);
    }

    const scanner = new StackScanner(process.cwd());
    console.log(chalk.dim("  Scanning project structure...\n"));

    const stack = scanner.detect();
    printDetectionResults(stack);

    const config = scanner.generateRules(stack);

    if (opts.provider) config.llmProvider = opts.provider as any;

    // Write config
    ConfigLoader.write(config, outputPath);

    // Scaffold templates directory
    scaffoldTemplates(path.join(process.cwd(), ".sla", "templates"));

    console.log(
      chalk.bold.green(
        `\n  ✅ Generated ${config.constraints.length} rules → ${outputPath}\n`
      )
    );

    console.log(chalk.bold("  Next steps:\n"));
    console.log(
      chalk.white(
        "  1. Review the generated rules in .sla/rules.yaml and tune to your team's standards"
      )
    );
    console.log(
      chalk.white(
        "  2. Run `sla audit` to see the current state of your codebase"
      )
    );
    console.log(
      chalk.white(
        "  3. Run `sla audit --fix` to auto-correct any violations found"
      )
    );
    console.log(
      chalk.white(
        "  4. Add .github/workflows/sla-check.yml to enforce rules in CI\n"
      )
    );
    console.log(
      chalk.dim(
        `  Detected provider: ${config.llmProvider ?? "none"} (set ${envVarName(config.llmProvider)} for auto-fix)\n`
      )
    );
  });

function printDetectionResults(stack: ReturnType<StackScanner["detect"]>): void {
  const checks: Array<[boolean, string, string]> = [
    [stack.hasNextJs, "Next.js", "NEXT-001 – NEXT-003"],
    [stack.hasSupabase, "Supabase", "SUPA-001 – SUPA-002"],
    [stack.hasPrisma, "Prisma ORM", "PRISMA-001 – PRISMA-002"],
    [stack.hasDrizzle, "Drizzle ORM", "DRIZZLE-001"],
    [stack.hasAWS, "AWS SDK / SAM", "AWS-001 – AWS-003"],
    [stack.hasReact, "React", "REACT-001 – REACT-002"],
    [stack.hasTRPC, "tRPC", "TRPC-001"],
    [stack.hasTailwind, "Tailwind CSS", "(style layer)"],
    [stack.hasZod, "Zod", "(validation schema)"],
    [stack.hasDocker, "Docker", "(infra layer)"],
  ];

  for (const [detected, label, rules] of checks) {
    const icon = detected ? chalk.green("✓") : chalk.dim("–");
    const text = detected ? chalk.white(label) : chalk.dim(label);
    const ruleText = detected ? chalk.dim(` → ${rules}`) : "";
    console.log(`    ${icon}  ${text.padEnd(20)}${ruleText}`);
  }

  console.log(
    chalk.dim("\n  Universal security rules always included: SEC-001 – SEC-003\n")
  );
}

function scaffoldTemplates(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const templates: Record<string, string> = {
    "TRANSFORM-DB-001.md": `ROLE: Senior Database Architect
CONTEXT: This project uses Drizzle ORM for type-safe database access.

INPUT_CODE: {{original_code}}
FILE_PATH: {{file_path}}
VIOLATIONS: {{violations}}

TASK:
1. Identify the table name and columns in any raw SQL queries.
2. Map them to the Drizzle schema in \`@/db/schema\`.
3. Replace raw queries with \`db.select().from(table).where(eq(table.col, value))\`.
4. Ensure return types use \`InferSelectModel<typeof table>\`.

CONSTRAINT: Never use \`db.execute(sql\`...\`)\` with dynamic user input.`,

    "SECURITY-SERVER-ACTION.md": `ROLE: Security-Focused Full-Stack Engineer
CONTEXT: Next.js Server Actions must validate session and input before executing.

INPUT_CODE: {{original_code}}
FILE_PATH: {{file_path}}
VIOLATIONS: {{violations}}

TASK:
1. Add \`const { data: { user } } = await supabase.auth.getUser()\` at the top.
2. Throw \`new Error('Unauthorized')\` if \`!user\`.
3. Define a Zod schema for all inputs and call \`schema.parse()\` before use.
4. Wrap the entire function body in try/catch.`,

    "SEC-TAINT-003.md": `ROLE: Cyber Security Officer
CONTEXT: This project uses React's Taint API for PII leak prevention.

INPUT_CODE: {{original_code}}
FILE_PATH: {{file_path}}
VIOLATIONS: {{violations}}

TASK:
1. Identify all variables containing PII (emails, IDs, tokens, passwords).
2. Wrap these values using \`experimental_taintUniqueValue\` at the data-fetching layer.
3. Use the error message: "Sensitive data must not be passed to client-side code."`,

    "FINOPS-ASYNC-002.md": `ROLE: Cloud Infrastructure Lead
CONTEXT: Server Actions have a 10s timeout. Heavy tasks must be queued via SQS/Lambda.

INPUT_CODE: {{original_code}}
FILE_PATH: {{file_path}}
VIOLATIONS: {{violations}}

TASK:
1. Extract heavy logic (file processing, bulk emails, PDF generation).
2. Replace it with \`await QueueService.enqueue('job-name', payload)\`.
3. Return a \`{ status: 'processing', jobId }\` response to the client.
4. Add a TODO for implementing the WebSocket completion listener.`,
  };

  for (const [filename, content] of Object.entries(templates)) {
    const filePath = path.join(dir, filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, content, "utf8");
    }
  }
}

function envVarName(provider?: string): string {
  switch (provider) {
    case "anthropic":
      return "ANTHROPIC_API_KEY";
    case "openai":
      return "OPENAI_API_KEY";
    case "gemini":
      return "GEMINI_API_KEY";
    default:
      return "ANTHROPIC_API_KEY";
  }
}

program.parse(process.argv);
