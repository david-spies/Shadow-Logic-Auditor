Here's exactly what you need to do to fix both badges.

## Badge 1 — CI Status (repo or workflow not found)
The shield points to sla-labs/sla-auditor but that GitHub org/repo doesn't exist yet. The fix is two steps:

Step 1 — Create the GitHub repo under the right name
The badge URL is:
https://img.shields.io/github/actions/workflow/status/sla-labs/sla-auditor/sla-check.yml
So your GitHub repo must be at exactly: github.com/sla-labs/sla-auditor
Either create the org sla-labs and repo sla-auditor, or — if you're using your personal account — update the badge URL to match your actual repo:
markdown[![CI](https://img.shields.io/github/actions/workflow/status/YOUR_USERNAME/sla-auditor/sla-check.yml?label=SLA%20Audit)](https://github.com/YOUR_USERNAME/sla-auditor)
Step 2 — Push the workflow file and trigger it once
The CI badge only goes green after the workflow has actually run at least once. Push everything to main, then open a pull request against main (or manually trigger it). Once the SLA Architectural Guardrail workflow completes, the badge will resolve.
bashgit init
git add .
git commit -m "feat: initial SLA Auditor v2.0"
git remote add origin https://github.com/YOUR_USERNAME/sla-auditor.git
git push -u origin main
The workflow file is already correctly placed at .github/workflows/sla-check.yml — GitHub will pick it up automatically on push.

## Badge 2 — npm (invalid)
The shield points to @sla/auditor on npm, which doesn't exist yet. You need to publish it.

Step 1 — Create an npm account and org
Go to npmjs.com and create an account. To publish a scoped package under @sla/auditor, you need to either:

Create the sla org on npm (npmjs.com/org/create), or
Change the package name to your own scope: @your-username/auditor

Update package.json "name" field to match whichever you choose.
Step 2 — Build and publish
bashnpm install
npm run build
npm login         # authenticate with your npm account
npm publish --access public
Step 3 — Update the badge URL to match your scope
markdown[![npm](https://img.shields.io/npm/v/@your-username/auditor)](https://www.npmjs.com/package/@your-username/auditor)

Practical shortcut if you want working badges without publishing to npm
Replace the npm badge with a version badge read directly from your package.json in the repo — no publishing required:
markdown[![version](https://img.shields.io/github/package-json/v/YOUR_USERNAME/sla-auditor)](https://github.com/YOUR_USERNAME/sla-auditor)
This reads the version field straight from GitHub and goes green the moment the repo is public.

Summary checklist

Create the GitHub repo at the path your badge URL references
Push all files including .github/workflows/sla-check.yml
Open one PR to trigger the CI workflow (it needs one successful run to show green)
Either publish to npm under a scope you own, or swap the npm badge for the GitHub package-json version badge
Update both badge URLs in README.md to use your actual username/org
