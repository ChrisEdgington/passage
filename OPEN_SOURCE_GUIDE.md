# Open Source Release Guide for Passage

This guide walks through the steps to make Passage your first open source project.

## Pre-Release Checklist

### 1. Repository Hygiene

- [x] **LICENSE file** - MIT license added
- [x] **README.md** - Comprehensive documentation with setup instructions
- [x] **.gitignore** - Ignores node_modules, dist, .env files, etc.
- [ ] **Remove any secrets** - Ensure no API keys, passwords, or personal data in code
- [ ] **Remove CLAUDE.md** - This file contains internal development notes (optional - some projects keep it)

### 2. Code Review

Before publishing, verify:

- [ ] No hardcoded paths specific to your machine
- [ ] No personal phone numbers or emails in test data
- [ ] No credentials in the codebase
- [ ] Example .env files don't contain real values

### 3. Files to Keep vs Remove

**Keep:**
- All source code in `apps/` and `packages/`
- README.md, LICENSE, package.json, pnpm-workspace.yaml
- Configuration files (biome.json, tsconfig.json, etc.)
- .gitignore, .nvmrc

**Consider removing or updating:**
- CLAUDE.md - Contains internal development guidance. You can keep it as an example of AI-assisted development, or remove it
- Any .env files with real values (add .env.example files instead)

## Creating the GitHub Repository

### Option A: Create via GitHub Web (Recommended for First Time)

1. Go to https://github.com/new
2. Fill in repository details:
   - **Repository name:** `passage`
   - **Description:** "Access iMessage and SMS from any web browser on your local network"
   - **Visibility:** Public
   - **Initialize:** Do NOT add README, .gitignore, or license (you already have these)
3. Click "Create repository"
4. Follow the instructions to push your existing code:

```bash
cd /path/to/passage
git init
git add .
git commit -m "Initial commit: Passage v0.1.0"
git branch -M main
git remote add origin git@github.com:YOUR_USERNAME/passage.git
git push -u origin main
```

### Option B: Create via GitHub CLI

```bash
# Install gh if needed: brew install gh
gh auth login
cd /path/to/passage
git init
git add .
git commit -m "Initial commit: Passage v0.1.0"
gh repo create passage --public --source=. --push
```

## About Licenses

You've chosen **MIT License** - this is a good choice because:

- **Permissive:** Anyone can use, modify, distribute, even commercially
- **Simple:** Short and easy to understand
- **Popular:** Most common license for open source projects
- **Compatible:** Works well with other open source licenses

### Why Not Let GitHub Create the License?

GitHub can add a LICENSE file for you, but since you already have one:
- You control the exact content
- The copyright year and name are correct
- No merge conflicts when pushing existing code

## Post-Release Steps

### 1. Add Topics/Tags on GitHub

After pushing, add topics to help discovery:
- Go to your repo on GitHub
- Click the gear icon next to "About"
- Add topics: `imessage`, `macos`, `typescript`, `react`, `nodejs`, `messages`, `sms`

### 2. Create a Release

```bash
# Tag the release
git tag -a v0.1.0 -m "Initial public release"
git push origin v0.1.0
```

Then on GitHub:
1. Go to Releases → Create a new release
2. Choose tag v0.1.0
3. Add release notes highlighting features

### 3. Optional Enhancements

Consider adding these later:
- **GitHub Actions** - CI/CD for testing and building
- **Issue templates** - Help users report bugs effectively
- **Contributing guide** - CONTRIBUTING.md with guidelines
- **Code of Conduct** - Standard open source conduct expectations
- **Discussions** - Enable GitHub Discussions for Q&A

## Promoting Your Project

### Share the LLM-First Story

Since this project is 100% LLM-generated, this is a great story angle:

1. **Twitter/X** - Share with screenshots, mention Claude Code
2. **Hacker News** - "Show HN: I built an iMessage web client using only AI prompts"
3. **Reddit** - r/programming, r/macapps, r/SideProject
4. **Dev.to/Medium** - Write about the LLM-first development experience

### Key Talking Points

- First project built entirely with Claude Code
- Solves real problem: access iMessages from non-Apple devices
- TV-optimized UI for couch messaging
- Real-time WebSocket updates
- How AI-assisted development changes the workflow

## Maintenance Tips

### Responding to Issues

- Acknowledge issues promptly, even if you can't fix immediately
- Use labels: `bug`, `enhancement`, `question`, `good first issue`
- Be welcoming to new contributors

### Managing Pull Requests

- Review PRs within a reasonable timeframe
- Provide constructive feedback
- Thank contributors

### Versioning

Follow semantic versioning:
- **PATCH** (0.1.1): Bug fixes
- **MINOR** (0.2.0): New features, backward compatible
- **MAJOR** (1.0.0): Breaking changes

## Quick Reference Commands

```bash
# Initialize and push to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin git@github.com:USERNAME/passage.git
git push -u origin main

# Create and push a tag
git tag -a v0.1.0 -m "Version 0.1.0"
git push origin v0.1.0

# View remote info
git remote -v

# Check what will be committed
git status
git diff --staged
```

---

Good luck with your first open source release! 🚀
