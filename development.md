# development.md — Shadow-Logic Auditor v2.0 Developer Guide

## Prerequisites

| Tool | Minimum Version | Notes |
|------|----------------|-------|
| Node.js | 20.0.0 | LTS recommended (22.x) |
| npm | 10.0.0 | Or pnpm 9+ |
| TypeScript | 5.5.0 | Installed via devDependencies |
| Git | 2.40+ | Required for `fetch-depth: 0` in CI |

---

## Local Setup

```bash
# 1. Clone the repo
git clone https://github.com/your-org/sla-auditor.git
cd sla-auditor

# 2. Install dependencies
npm install

# 3. Build the TypeScript source
npm run build

# 4. Link for local CLI testing
npm link

# 5. Verify installation
sla --version
```

---

## Environment Variables

Create a `.env` file in the project root (never commit this):

```bash
# Required for auto-fix features
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AI...

# Optional overrides
SLA_RULES_PATH=.sla/rules.yaml
SLA_LOG_LEVEL=info          # silent | info | debug
```

---

## Development Workflow

### 1. Adding a New Rule

Rules live in `.sla/rules.yaml`. Each rule requires:

```yaml
- id: CATEGORY-NNN          # Unique ID: [CATEGORY]-[NUMBER]
  name: "Descriptive Name"
  category: security         # security | architecture | performance | finops | style | data | custom
  severity: HIGH             # LOW | MEDIUM | HIGH | CRITICAL
  pattern:
    regex: "your-regex-here"
    scope: "**/components/**" # Optional: limit to specific paths
  requirement: "What the code MUST do instead."
  advice: "Practical tip for fixing this."   # Optional
  autoFix:
    useLLM: true              # Use LLM to fix
    templateRef: "TEMPLATE-ID" # Optional: load .sla/templates/TEMPLATE-ID.md
    replace: "literal string" # Deterministic regex replacement (no LLM needed)
  tags: [category, tag2]
```

**Rule ID convention:** `SEC-001`, `ARCH-002`, `AWS-001`, `NEXT-003`, `PERF-001`

### 2. Testing a Rule Locally

```bash
# Audit a specific file
sla audit --files src/components/MyComponent.tsx --verbose

# Audit against a specific rules file
sla audit --files src/ --rules .sla/rules.yaml

# Audit only HIGH and above
sla audit --severity HIGH

# Audit only security rules
sla audit --category security

# Preview what auto-fix would do (no writes)
sla audit --files src/components/MyComponent.tsx --fix --dry-run
```

### 3. Testing Auto-Fix

```bash
# Run with LLM fix enabled (requires API key in .env)
sla audit --files src/bad-example.ts --fix

# Full project audit + fix with JSON output
sla audit --fix --json --output audit-report.json
```

### 4. Running Tests

```bash
# Run all tests
npm test

# Watch mode during development
npm run test:watch

# Coverage report
npm test -- --coverage
```

### 5. Type Checking

```bash
npm run typecheck
```

### 6. Linting

```bash
npm run lint
npm run lint:fix
```

---

## Project Structure

```
sla-auditor/
├── src/
│   ├── types.ts                  # All shared TypeScript types and interfaces
│   ├── index.ts                  # Public library exports
│   ├── engine/
│   │   ├── rule-engine.ts        # Core pattern matching & violation detection
│   │   ├── config-loader.ts      # YAML config loading, validation (Zod), caching
│   │   └── llm-provider.ts       # Unified Anthropic / OpenAI / Gemini abstraction
│   ├── auditors/
│   │   ├── file-scanner.ts       # File discovery, batch audit orchestration
│   │   └── stack-scanner.ts      # Heuristic stack detection for `sla init`
│   ├── fixers/
│   │   └── auto-fixer.ts         # Two-pass fix: deterministic first, then LLM
│   ├── reporters/
│   │   ├── terminal-reporter.ts  # Rich colored terminal output
│   │   └── json-reporter.ts      # Machine-readable JSON for CI pipelines
│   └── cli/
│       ├── index.ts              # `sla` root command dispatcher
│       ├── audit.ts              # `sla audit` command
│       └── init.ts               # `sla init` command (stack scanner)
├── tests/
│   ├── rule-engine.test.ts       # Unit tests: pattern matching, fix application
│   └── stack-scanner.test.ts     # Integration tests: file system detection
├── .sla/
│   ├── rules.yaml                # Default rules (self-dogfooding)
│   └── templates/                # Prompt templates for LLM auto-fixer
│       ├── TRANSFORM-DB-001.md
│       ├── SECURITY-SERVER-ACTION.md
│       ├── SEC-TAINT-003.md
│       └── FINOPS-ASYNC-002.md
├── .github/
│   └── workflows/
│       └── sla-check.yml         # CI/CD enforcement workflow
├── package.json
├── tsconfig.json
├── jest.config.ts
├── requirements.txt
├── techstack.md
├── development.md
└── README.md
```

---

## Adding a New LLM Provider

1. Open `src/engine/llm-provider.ts`
2. Create a new class extending `BaseLLMClient`
3. Implement the `chat(messages, opts)` method
4. Add the provider key to `DEFAULT_MODELS`
5. Add a case to the `createLLMClient` factory function
6. Add the provider to the `LLMProvider` type in `src/types.ts`

---

## Adding a New Reporter

1. Create `src/reporters/my-reporter.ts`
2. Implement a class that accepts `AuditReport` and produces output
3. Export it from `src/index.ts`
4. Wire it into `src/cli/audit.ts` via a `--format` flag

---

## CI/CD Setup for a New Repository

```bash
# 1. Run sla init in the target repo
cd your-project
npx @sla/auditor init

# 2. Review and tune .sla/rules.yaml

# 3. Copy the GitHub Actions workflow
cp node_modules/@sla/auditor/.github/workflows/sla-check.yml .github/workflows/

# 4. Add secrets to your GitHub repo:
#    Settings → Secrets → Actions:
#    - ANTHROPIC_API_KEY (or OPENAI_API_KEY)

# 5. Push and open a PR to test
```

---

## Writing Prompt Templates

Templates live in `.sla/templates/` and are referenced by `autoFix.templateRef` in rules.yaml.

A template is a Markdown file with three placeholder tokens:

| Token | Replaced With |
|-------|--------------|
| `{{original_code}}` | The full content of the violating file |
| `{{file_path}}` | The relative path of the file |
| `{{violations}}` | A formatted list of violations with rule IDs and requirements |

**Best practices:**
- Start with a `ROLE:` declaration to set the LLM's persona
- Include a `CONTEXT:` section explaining your stack's specific conventions
- List explicit, numbered steps in `TASK:` — avoid open-ended instructions
- Add a `CONSTRAINT:` section with hard "never do" rules
- Keep templates under 600 tokens to leave room for the code payload

---

## Release Process

```bash
# 1. Bump version
npm version patch | minor | major

# 2. Build
npm run build

# 3. Run tests
npm test

# 4. Publish
npm publish --access public

# 5. Tag and push
git push --follow-tags
```

---

## Known Limitations

- **Regex-based rules** can produce false positives on complex multi-line patterns. Use the `scope` field to narrow applicability.
- **LLM auto-fix confidence** varies. The fixer runs a second audit pass after applying a fix; if violations remain, they are reported but not re-attempted (to avoid infinite loops).
- **Binary files** (images, fonts, compiled artifacts) are automatically skipped by the file scanner.
- **Very large files** (>500KB) may cause LLM context window issues. The fixer will log a warning and skip them.
