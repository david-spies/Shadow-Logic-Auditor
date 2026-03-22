📝 Shadow-Logic Auditor (SLA) Starter Kit
Overview

The Shadow-Logic Auditor (SLA) is a 2026-standard development tool designed to prevent "AI-driven technical debt." It intercepts LLM-generated code (from Claude, ChatGPT, or Gemini), audits it against your project’s specific architectural rules, and automatically refactors violations before they hit your main branch.

🚀 Quick Start
'''
    Initialize SLA: Run npx sla-cli init to scan your stack and generate .sla/rules.yaml.

    Configure Provider: Add your ANTHROPIC_API_KEY or OPENAI_API_KEY to your environment.

    Install IDE Plugin: (Optional) Install the VS Code / Cursor extension to catch violations in real-time.

    CI Integration: Add the provided GitHub Action to enforce rules on every Pull Request.
'''

📁 Folder Structure
---

## Project Structure

```

.sla/
├── rules.yaml          # Your architectural source of truth
├── templates/          # Prompt templates for the Auto-Fixer
│   ├── db-fix.md
│   └── security-fix.md
scripts/
└── sla-audit.ts        # The core logic engine

```

---

## License

MIT © 2026 Shadow-Logic Auditor (SLA)
