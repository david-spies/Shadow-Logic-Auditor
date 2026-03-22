# Shadow-Logic Auditor (SLA) v2.0

> **AI-driven technical debt prevention for teams that ship fast.**
> Intercepts LLM-generated code, audits it against your architectural rules, and auto-corrects violations before they reach your main branch.

[![CI](https://img.shields.io/github/actions/workflow/status/david-spies/sla-auditor/sla-check.yml?label=SLA%20Audit)](https://github.com/david-spies/sla-auditor)
[![npm](https://img.shields.io/npm/v/@sla/auditor)](https://www.npmjs.com/package/@sla/auditor)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## The Problem

LLMs write code fast — but they write it for a generic project, not *yours*. They don't know that:

- Your controllers must never import the DB client directly
- Your Lambda functions must use ARM64 to cut cloud costs by 20%
- Your Server Actions are required to validate input with Zod
- Your Supabase service role key must never touch a client bundle

The result: AI-generated code that looks right, passes syntax checks, and silently introduces architectural violations, security holes, and FinOps waste. We call this **Shadow Logic** — code that looks clean but undermines your system's foundations.

SLA fixes this.

---

## How It Works

```
Developer asks AI → LLM generates code → SLA intercepts
        ↓
  Pattern matching against .sla/rules.yaml
        ↓
  Violation? → Deterministic fix (instant)
            → LLM-powered rewrite (auto-fix mode)
            → Block with explanation (strict mode)
        ↓
  Clean, compliant code hits your branch
```

Three enforcement modes:

| Mode | Behavior |
|------|----------|
| `warn` | Reports violations, never blocks |
| `block` | Exits with code 1 on any violation |
| `auto-fix` | Attempts to fix violations before blocking |

---

## Quick Start

### 1. Install

```bash
npm install -g @sla/auditor
# or
npx @sla/auditor init
```

### 2. Initialize your project

```bash
cd your-project
sla init
```

SLA scans your `package.json` and file structure to auto-detect your stack (Next.js, Supabase, Prisma, AWS, tRPC, etc.) and generates a tailored `.sla/rules.yaml`.

```
  ✓ Next.js          → NEXT-001 – NEXT-003
  ✓ Supabase         → SUPA-001 – SUPA-002
  ✓ Prisma ORM       → PRISMA-001 – PRISMA-002
  ✓ AWS SDK / SAM    → AWS-001 – AWS-003
  –  Drizzle ORM     (not detected)
  Universal security rules always included: SEC-001 – SEC-003

  ✅ Generated 14 rules → .sla/rules.yaml
```

### 3. Run your first audit

```bash
sla audit
```

### 4. Auto-fix violations

```bash
# Set your LLM API key
export ANTHROPIC_API_KEY=sk-ant-...

sla audit --fix
```

### 5. Add CI enforcement

```bash
# Copy the workflow to your repo
cp node_modules/@sla/auditor/.github/workflows/sla-check.yml .github/workflows/
```

Add `ANTHROPIC_API_KEY` to your GitHub repository secrets and every PR will be automatically audited and fixed.

---

## CLI Reference

### `sla init`

Scans your project and generates `.sla/rules.yaml`.

```bash
sla init [options]

Options:
  --force        Overwrite existing rules.yaml
  --minimal      Generate only universal security rules
  -p, --provider Set the LLM provider (anthropic|openai|gemini)  [default: anthropic]
```

### `sla audit`

Audit source files against your architectural rules.

```bash
sla audit [options]

Options:
  -f, --files <paths...>     Specific files to audit
  --files-from <path>        Text file with one file path per line
  --fix                      Auto-fix violations (deterministic + LLM)
  --dry-run                  Preview fixes without writing to disk
  -r, --rules <path>         Rules file path  [default: .sla/rules.yaml]
  -s, --severity <level>     Filter by minimum severity (LOW|MEDIUM|HIGH|CRITICAL)
  -c, --category <name>      Filter by rule category
  --json                     Output results as JSON
  -o, --output <path>        Write JSON report to file
  -p, --provider <name>      Override LLM provider
  -m, --model <name>         Override LLM model
  -v, --verbose              Show passing files and extended details
  --ci                       Exit 1 even after auto-fixes (for strict CI gates)
```

### `sla rules`

List all active rules from the current config.

```bash
sla rules [-r .sla/rules.yaml]
```

---

## Writing Rules

Rules live in `.sla/rules.yaml`. A complete rule looks like this:

```yaml
constraints:
  - id: NEXT-001                          # Unique ID
    name: "Server Action Auth Guard"
    category: security                    # security|architecture|performance|finops|style|data|custom
    severity: CRITICAL                    # LOW|MEDIUM|HIGH|CRITICAL
    pattern:
      regex: "^export async function \\w+\\("
      scope: "**/app/**/actions.ts"       # Optional glob scope
    requirement: "All Server Actions must validate user session before executing."
    advice: "Add `const { data: { user } } = await supabase.auth.getUser()` at the top."
    autoFix:
      useLLM: true                        # Use LLM for complex rewrites
      templateRef: "SECURITY-SERVER-ACTION" # Reference .sla/templates/SECURITY-SERVER-ACTION.md
    tags: [nextjs, auth, security]
```

### Deterministic fixes (no LLM needed)

For simple find-and-replace violations, use `autoFix.replace`:

```yaml
  - id: AWS-001
    name: Lambda ARM64 Enforcement
    category: finops
    severity: MEDIUM
    pattern:
      regex: "Architecture:\\s*['\"]x86_64['\"]"
      scope: "**/template.yaml"
    requirement: All Lambda functions must use arm64 for cost savings.
    autoFix:
      replace: "Architecture: arm64"     # Instant, no API call needed
```

---

## Real-World Example

**Developer prompt to Claude:** "Create a server action to update a user's subscription."

**What Claude generates (Shadow Logic):**
```typescript
// app/actions.ts ← DANGEROUS
export async function updatePlan(planId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY  // ← NEXT-002 violation
  );
  await supabase.from('subscriptions').update({ plan_id: planId });
  // ← NEXT-001: no auth check
  // ← NEXT-003: no Zod validation
}
```

**SLA detects:** `NEXT-001`, `NEXT-002`, `NEXT-003`

**SLA auto-fixes to:**
```typescript
// app/actions.ts ← AUDITED & COMPLIANT
'use server'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';

const schema = z.object({ planId: z.string().uuid() });

export async function updatePlan(formData: FormData) {
  const supabase = createServerActionClient({ cookies });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Unauthorized');

  const { planId } = schema.parse({ planId: formData.get('planId') });

  return supabase
    .from('subscriptions')
    .update({ plan_id: planId })
    .eq('user_id', user.id);
}
```

The developer sees the compliant version. The violation never reaches main.

---

## Using SLA as a Library

```typescript
import { RuleEngine, ConfigLoader, FileScanner } from '@sla/auditor';

const config = ConfigLoader.load('.sla/rules.yaml');
const engine = new RuleEngine(config);
const scanner = new FileScanner(engine, config);

const report = await scanner.audit({
  files: ['src/components/UserCard.tsx'],
  fix: true,
  provider: 'anthropic',
});

console.log(`Violations: ${report.totalViolations}`);
console.log(`Fixed: ${report.fixedFiles}`);
```

---

## Supported Stacks

| Stack | Rules Generated |
|-------|----------------|
| Next.js (App Router) | Server Action auth, Zod validation, client bundle safety |
| Supabase | RLS bypass detection, RPC injection prevention |
| Prisma | No direct client in components, no raw SQL |
| Drizzle ORM | No dynamic SQL execution |
| AWS SAM/CDK | ARM64 enforcement, no public S3, single-purpose Lambdas |
| React | No `useEffect` data fetching, PII Taint API |
| tRPC | Auth middleware on mutation procedures |
| Universal | No hardcoded secrets, no `eval()`, no env vars in client |

---

## CI/CD Integration

The included GitHub Actions workflow (`sla-check.yml`) provides:

- **Targeted scanning** — only audits files changed in the PR
- **Auto-fix + commit** — fixes violations and pushes a new commit automatically
- **PR comment** — posts a structured report with violation details
- **Gate enforcement** — blocks merge on unresolved violations

See `.github/workflows/sla-check.yml` for the complete workflow definition.

---

## Project Structure

```
.sla/
├── rules.yaml            ← Your architectural source of truth
└── templates/            ← Prompt templates for LLM auto-fixer
    ├── TRANSFORM-DB-001.md
    ├── SECURITY-SERVER-ACTION.md
    ├── SEC-TAINT-003.md
    └── FINOPS-ASYNC-002.md

src/
├── engine/               ← Rule matching, config loading, LLM abstraction
├── auditors/             ← File scanner, stack scanner
├── fixers/               ← Deterministic + LLM two-pass auto-fixer
├── reporters/            ← Terminal (colored) + JSON (CI) reporters
└── cli/                  ← sla, sla audit, sla init commands

.github/workflows/
└── sla-check.yml         ← CI/CD enforcement workflow
```

---

## Documentation

- [`techstack.md`](./techstack.md) — Full technology stack and architecture decisions
- [`development.md`](./development.md) — Developer setup, workflow, and contribution guide
- [`requirements.txt`](./requirements.txt) — Dependency manifest with version pins

---

## License

MIT — see [LICENSE](./LICENSE)

---

*Built for engineering teams that refuse to let AI speed come at the cost of architectural discipline.*
