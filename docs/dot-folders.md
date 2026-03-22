## Dot folders (.sla/, .github/) aren't disappearing — they're hidden by default in most file explorers because any folder starting with . is treated as a hidden system folder on Mac and Linux.

> Here's the proper process depending on your environment.

The Core Issue
Most GUI file managers hide dot folders. The files are there — you just can't see them without changing a setting or using the terminal.

Method 1 — Terminal (Most Reliable)
This is the correct professional workflow for a project like this. From your project root:
bash# Create the folder structure first
mkdir -p .sla/templates
mkdir -p .github/workflows

# Create rules.yaml
touch .sla/rules.yaml

# Create the workflow file
touch .github/workflows/sla-check.yml
Then open those files in your editor and paste the content in. The -p flag creates nested folders in one command and won't error if they already exist.

Method 2 — VS Code (Recommended Editor Approach)
VS Code shows dot folders by default in the Explorer sidebar. If you don't see them:

Open the Command Palette (Cmd+Shift+P on Mac, Ctrl+Shift+P on Windows)
Search for Files: Exclude
Make sure **/.git is listed but .sla and .github are not in the exclude list

To create the files directly in VS Code:

Right-click in the Explorer sidebar → New Folder → type .sla
Right-click .sla → New Folder → type templates
Right-click .github → New Folder → type workflows
Then right-click each folder → New File to create the .yaml files


Method 3 — Make Dot Folders Visible in Finder (Mac)
Press Cmd + Shift + . in any Finder window. This toggles hidden files on/off. You'll see all your dot folders appear immediately. Press the same shortcut again to hide them.

Method 4 — Make Dot Folders Visible in Windows Explorer

Open File Explorer
Click View in the top menu
Check Hidden items


Recommended Project Build Order
When setting up this project from scratch, follow this sequence:

'''

# 1. Create your project root and enter it
mkdir sla-auditor && cd sla-auditor

# 2. Initialize git (this creates .git/ — confirms dot folders work)
git init

# 3. Create all dot folders upfront
mkdir -p .sla/templates
mkdir -p .github/workflows
mkdir -p src/engine src/auditors src/fixers src/reporters src/cli
mkdir -p tests

# 4. Copy or create each file into place
# (paste content from the generated files)

# 5. Verify everything is there — the -a flag shows hidden files
ls -la
ls -la .sla/
ls -la .github/workflows/

'''

The ls -la command is your best friend here — it lists all files including hidden ones, so you can confirm your dot folders actually exist.

Verifying the Structure is Correct
After placing all files, run this from your project root to see the complete tree including hidden folders:

find . -not -path '*/node_modules/*' -not -path '*/.git/*' | sort

You should see .sla/rules.yaml, .sla/templates/, and .github/workflows/sla-check.yml in the output. If you do, they're there — GitHub, npm, and the SLA CLI will all find them correctly.
