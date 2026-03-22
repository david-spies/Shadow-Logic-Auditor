// src/engine/config-loader.ts — Load, validate, and merge SLA rule configs

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import { z } from "zod";
import type { SLARulesConfig, SLARule } from "../types.js";

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const RulePatternSchema = z.object({
  regex: z.string().optional(),
  scope: z.string().optional(),
  astNode: z.string().optional(),
});

const AutoFixSchema = z.object({
  replace: z.string().optional(),
  templateRef: z.string().optional(),
  useLLM: z.boolean().optional(),
});

const SLARuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  category: z.enum([
    "security",
    "architecture",
    "performance",
    "finops",
    "style",
    "data",
    "custom",
  ]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  pattern: RulePatternSchema,
  requirement: z.string(),
  advice: z.string().optional(),
  autoFix: AutoFixSchema.optional(),
  tags: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
});

const SLARulesConfigSchema = z.object({
  version: z.string(),
  project: z.string(),
  description: z.string().optional(),
  enforcementLevel: z.enum(["warn", "block", "auto-fix"]),
  llmProvider: z.enum(["anthropic", "openai", "gemini"]).optional(),
  llmModel: z.string().optional(),
  ignorePatterns: z.array(z.string()).optional(),
  constraints: z.array(SLARuleSchema),
});

// ─── Loader ───────────────────────────────────────────────────────────────────

export class ConfigLoader {
  private static cache: Map<string, SLARulesConfig> = new Map();

  /**
   * Load and validate rules config from a YAML file path.
   * Throws descriptive errors if the config is malformed.
   */
  static load(rulesPath: string): SLARulesConfig {
    const absPath = path.resolve(rulesPath);

    if (this.cache.has(absPath)) {
      return this.cache.get(absPath)!;
    }

    if (!fs.existsSync(absPath)) {
      throw new Error(
        `SLA rules file not found at: ${absPath}\n` +
          `Run "sla init" to generate one.`
      );
    }

    const raw = fs.readFileSync(absPath, "utf8");
    let parsed: unknown;

    try {
      parsed = yaml.load(raw);
    } catch (err) {
      throw new Error(`Failed to parse YAML at ${absPath}: ${err}`);
    }

    const result = SLARulesConfigSchema.safeParse(parsed);

    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      throw new Error(`Invalid SLA config at ${absPath}:\n${issues}`);
    }

    const config = result.data as SLARulesConfig;
    this.cache.set(absPath, config);
    return config;
  }

  /**
   * Merge two configs together (e.g., base + project-specific overrides).
   */
  static merge(base: SLARulesConfig, override: Partial<SLARulesConfig>): SLARulesConfig {
    const existingIds = new Set(base.constraints.map((c) => c.id));
    const newConstraints = (override.constraints ?? []).filter(
      (c) => !existingIds.has(c.id)
    );

    return {
      ...base,
      ...override,
      constraints: [...base.constraints, ...newConstraints],
    };
  }

  /**
   * Write a config object to disk as YAML.
   */
  static write(config: SLARulesConfig, outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const content = yaml.dump(config, { lineWidth: 120, noRefs: true });
    fs.writeFileSync(outputPath, content, "utf8");
    this.cache.delete(path.resolve(outputPath));
  }

  /**
   * Clear the in-memory config cache (useful for tests).
   */
  static clearCache(): void {
    this.cache.clear();
  }
}
