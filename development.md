⚙️ File 3: development.md (Workflow Guide)

Development Cycle:

  >  Define a Rule: Add a regex or AST pattern to .sla/rules.yaml.

  >  Test Locally: Run sla audit --file path/to/file.ts.

  >  Check Auto-Fix: Run sla audit --file path/to/file.ts --fix to verify the AI refactor logic.

  >  Deploy: Push changes to GitHub. The SLA-Check Action will handle the rest.
