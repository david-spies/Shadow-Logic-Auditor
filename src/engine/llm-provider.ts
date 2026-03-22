// src/engine/llm-provider.ts — Unified interface over Anthropic, OpenAI, and Gemini

import type { LLMProvider, LLMFixResponse, Violation } from "../types.js";

export interface LLMMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LLMRequestOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  gemini: "gemini-1.5-pro",
};

// ─── Abstract base ────────────────────────────────────────────────────────────

abstract class BaseLLMClient {
  abstract chat(
    messages: LLMMessage[],
    opts?: LLMRequestOptions
  ): Promise<string>;

  /**
   * High-level: request a compliant rewrite of violating code.
   */
  async requestFix(
    originalCode: string,
    filePath: string,
    violations: Violation[],
    templateContent?: string
  ): Promise<LLMFixResponse> {
    const violationBlock = violations
      .map(
        (v) =>
          `- [${v.ruleId}] ${v.ruleName} (${v.severity})\n  Requirement: ${v.requirement}\n  Advice: ${v.advice ?? "Follow the requirement above."}`
      )
      .join("\n\n");

    const systemPrompt = `You are an expert Senior Software Engineer and Architectural Auditor.
Your task is to refactor provided code so it complies with project-specific architectural rules.
You MUST respond with a JSON object in this exact shape:
{
  "fixedCode": "<the full refactored file content>",
  "explanation": "<one paragraph explaining what changed and why>",
  "confidence": <number between 0 and 1>,
  "violationsAddressed": ["RULE-ID-1", "RULE-ID-2"]
}
Do NOT wrap the JSON in markdown fences. Return raw JSON only.`;

    const userContent = templateContent
      ? templateContent
          .replace("{{original_code}}", originalCode)
          .replace("{{file_path}}", filePath)
          .replace("{{violations}}", violationBlock)
      : `FILE: ${filePath}

VIOLATIONS TO FIX:
${violationBlock}

ORIGINAL CODE:
\`\`\`
${originalCode}
\`\`\`

Refactor the code to resolve all violations. Preserve all original business logic.`;

    const raw = await this.chat(
      [{ role: "user", content: userContent }],
      {
        systemPrompt,
        maxTokens: 4096,
        temperature: 0.1,
      }
    );

    return this.parseFixResponse(raw, violations);
  }

  private parseFixResponse(raw: string, violations: Violation[]): LLMFixResponse {
    try {
      // Strip markdown fences if the model wrapped it anyway
      const cleaned = raw
        .replace(/^```(?:json)?\n?/m, "")
        .replace(/\n?```$/m, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      return {
        fixedCode: parsed.fixedCode ?? raw,
        explanation: parsed.explanation ?? "No explanation provided.",
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.8,
        violationsAddressed:
          parsed.violationsAddressed ?? violations.map((v) => v.ruleId),
      };
    } catch {
      // Fallback: treat the raw response as plain fixed code
      return {
        fixedCode: raw,
        explanation: "LLM returned non-JSON; treating response as fixed code.",
        confidence: 0.5,
        violationsAddressed: violations.map((v) => v.ruleId),
      };
    }
  }
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

class AnthropicClient extends BaseLLMClient {
  private sdk: import("@anthropic-ai/sdk").default;
  private model: string;

  constructor(apiKey: string, model?: string) {
    super();
    // Dynamic import to avoid crashing when not installed
    const { default: Anthropic } = require("@anthropic-ai/sdk");
    this.sdk = new Anthropic({ apiKey });
    this.model = model ?? DEFAULT_MODELS.anthropic;
  }

  async chat(messages: LLMMessage[], opts?: LLMRequestOptions): Promise<string> {
    const systemMsg = opts?.systemPrompt;
    const response = await (this.sdk as any).messages.create({
      model: opts?.model ?? this.model,
      max_tokens: opts?.maxTokens ?? 4096,
      ...(systemMsg ? { system: systemMsg } : {}),
      messages: messages.filter((m) => m.role !== "system").map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    });
    return response.content[0].text as string;
  }
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

class OpenAIClient extends BaseLLMClient {
  private sdk: import("openai").default;
  private model: string;

  constructor(apiKey: string, model?: string) {
    super();
    const { default: OpenAI } = require("openai");
    this.sdk = new OpenAI({ apiKey });
    this.model = model ?? DEFAULT_MODELS.openai;
  }

  async chat(messages: LLMMessage[], opts?: LLMRequestOptions): Promise<string> {
    const msgs = opts?.systemPrompt
      ? [{ role: "system" as const, content: opts.systemPrompt }, ...messages]
      : messages;

    const response = await (this.sdk as any).chat.completions.create({
      model: opts?.model ?? this.model,
      max_tokens: opts?.maxTokens ?? 4096,
      temperature: opts?.temperature ?? 0.1,
      messages: msgs as any,
    });
    return response.choices[0].message.content ?? "";
  }
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

class GeminiClient extends BaseLLMClient {
  private genAI: any;
  private model: string;

  constructor(apiKey: string, model?: string) {
    super();
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = model ?? DEFAULT_MODELS.gemini;
  }

  async chat(messages: LLMMessage[], opts?: LLMRequestOptions): Promise<string> {
    const modelInstance = this.genAI.getGenerativeModel({
      model: opts?.model ?? this.model,
    });

    const prompt = messages.map((m) => `[${m.role.toUpperCase()}]: ${m.content}`).join("\n\n");
    const fullPrompt = opts?.systemPrompt
      ? `${opts.systemPrompt}\n\n${prompt}`
      : prompt;

    const result = await modelInstance.generateContent(fullPrompt);
    return result.response.text();
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createLLMClient(
  provider: LLMProvider,
  model?: string
): BaseLLMClient {
  switch (provider) {
    case "anthropic": {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error("ANTHROPIC_API_KEY is not set.");
      return new AnthropicClient(key, model);
    }
    case "openai": {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error("OPENAI_API_KEY is not set.");
      return new OpenAIClient(key, model);
    }
    case "gemini": {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error("GEMINI_API_KEY is not set.");
      return new GeminiClient(key, model);
    }
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
