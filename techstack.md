# techstack.md — Shadow-Logic Auditor v2.0

## Overview

The Shadow-Logic Auditor (SLA) is a TypeScript-native CLI tool and Node.js library. It is intentionally dependency-light at its core, pulling in LLM SDKs only when the auto-fix feature is invoked. This keeps cold-start time low for local and CI usage.

---

## Runtime Environment

| Component | Choice | Rationale |
|-----------|--------|-----------|
| **Language** | TypeScript 5.5+ | Strict mode, `exactOptionalPropertyTypes`, full ESM |
| **Runtime** | Node.js 22 LTS | Required for native `fetch`, `--experimental-vm-modules` in Jest |
| **Module System** | ESM (`"module": "NodeNext"`) | Tree-shakeable, modern import semantics |
| **Build Tool** | `tsc` (TypeScript compiler) | Zero-config, no bundler overhead needed for a CLI |
| **Package Manager** | npm / pnpm compatible | Standard lockfile support |

---

## Core Engine

| Layer | Library | Version | Purpose |
|-------|---------|---------|---------|
| **Config parsing** | `js-yaml` | ^4.1.0 | Reads `.sla/rules.yaml` |
| **Config validation** | `zod` | ^3.23.8 | Runtime schema enforcement on rules |
| **Pattern matching** | Built-in `RegExp` | — | Multi-pass regex scanning with line/col resolution |
| **Scope matching** | `micromatch` | ^4.0.8 | Glob-based file scope filtering per rule |
| **File discovery** | `fast-glob` | ^3.3.2 | High-performance recursive file enumeration |
| **Ignore patterns** | `ignore` | ^5.3.2 | `.gitignore`-compatible exclusion |
| **Caching** | `node-cache` | ^5.1.2 | In-memory config cache between invocations |

---

## LLM Provider Abstraction

SLA ships a unified `LLMClient` interface that wraps three providers. The correct SDK is loaded dynamically at runtime only when a fix is requested — avoiding startup cost and unnecessary API calls.

| Provider | SDK | Default Model | Notes |
|----------|-----|--------------|-------|
| **Anthropic** | `@anthropic-ai/sdk` ^0.27.0 | `claude-sonnet-4-20250514` | Primary recommendation. Best code reasoning. |
| **OpenAI** | `openai` ^4.52.0 | `gpt-4o` | Strong alternative. |
| **Google Gemini** | `@google/generative-ai` ^0.15.0 | `gemini-1.5-pro` | Budget-friendly for large codebases. |

All providers implement the same `requestFix()` method: they receive the original code, a list of structured violations, and an optional prompt template, then return a `LLMFixResponse` with `fixedCode`, `explanation`, `confidence`, and `violationsAddressed`.

---

## CLI Framework

| Library | Version | Purpose |
|---------|---------|---------|
| `commander` | ^12.1.0 | Sub-command routing (`sla init`, `sla audit`, `sla rules`) |
| `chalk` | ^5.3.0 | ANSI color output in terminal reporter |
| `ora` | ^8.1.0 | Progress spinners for long-running LLM operations |
| `enquirer` | ^2.4.1 | Interactive confirmation prompts in `sla init` |
| `boxen` | ^8.0.1 | Bordered summary boxes in terminal output |

---

## Testing

| Library | Version | Purpose |
|---------|---------|---------|
| `jest` | ^29.7.0 | Test runner |
| `ts-jest` | ^29.2.4 | TypeScript transform for Jest |
| Coverage threshold | 80% lines | Enforced via `jest.config.ts` |

Test categories:
- **Unit**: Rule engine pattern matching, config validation, deterministic fixes
- **Integration**: Stack scanner file system operations, config read/write cycle
- **Snapshot**: JSON report shape stability

---

## CI/CD Integration

| Component | Technology |
|-----------|-----------|
| **Workflow trigger** | `pull_request` on `main`, `develop`, `staging` |
| **Changed file detection** | `git diff --name-only origin/<base>...HEAD` |
| **Auto-fix commit** | `actions/checkout@v4` with write permissions, bot-signed commits |
| **PR annotation** | `actions/github-script@v7` — posts structured Markdown comment |
| **Exit codes** | `0` = pass, `1` = unresolved violations, `2` = configuration error |

---

## Architecture Decisions

### Why regex over AST (Tree-sitter)?

Regex patterns cover the vast majority of architectural violations detectable without deep semantic understanding (import paths, env variable access, SQL patterns, AWS config). An AST layer via Tree-sitter is planned for v3.0 for rules that require semantic context (e.g., "function returns a tainted value to a client boundary").

### Why YAML for rules?

YAML is the most readable format for non-engineers (tech leads, security teams) who need to author or review architectural constraints. A future TypeScript DSL is planned as an opt-in alternative for teams that want IDE autocomplete when writing rules.

### Why not lint rules (ESLint)?

ESLint is an excellent tool but operates at the syntax/AST layer and requires plugin authoring for each rule. SLA's rules are **semantic and architectural** — they span file scopes, directory structures, and cross-file import patterns, and they carry remediation prompts that feed directly into the LLM auto-fixer. These concerns are outside ESLint's design target.

---

## Roadmap

| Version | Planned Capability |
|---------|--------------------|
| **v2.1** | VSCode extension with inline violation highlighting |
| **v2.2** | Tree-sitter AST rules for semantic analysis |
| **v2.3** | Rule marketplace — shareable community rule packs |
| **v3.0** | TypeScript DSL for rules, web dashboard for team analytics |
