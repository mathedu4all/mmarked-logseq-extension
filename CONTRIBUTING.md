# Contributing to Logseq MMarked Extension

Thank you for your interest in contributing! This document provides complete guidelines for developing and contributing to the project.

---

## 📋 Table of Contents

- [Development Setup](#development-setup)
- [Development Scripts](#development-scripts)
- [Local Testing & Debugging](#local-testing--debugging)
- [Release Process](#release-process)
- [Code Style](#code-style)
- [Commit Guidelines](#commit-guidelines)
- [Submitting Changes](#submitting-changes)
- [Technical Details](#technical-details)

---

## 🛠️ Development Setup

### Prerequisites
- Node.js >= 14
- npm >= 7
- Git

### Getting Started

1. Fork the repository on GitHub

2. Clone your fork:
```bash
git clone https://github.com/YOUR_USERNAME/mmarked-logseq-extension.git
cd mmarked-logseq-extension
```

3. Add upstream remote:
```bash
git remote add upstream https://github.com/mathedu4all/mmarked-logseq-extension.git
```

4. Install dependencies:
```bash
npm install
```

5. Sync with upstream (before starting work):
```bash
# Fetch latest changes from upstream
git fetch upstream

# Update your main branch
git checkout main
git merge upstream/main
git push origin main
```

6. Create a feature branch:
```bash
git checkout -b feature/your-feature-name
```

---

## 📜 Development Scripts

```bash
# Build the plugin
npm run build

# Clean build artifacts
npm run clean

# Code quality
npm run lint              # Check code style
npm run lint:fix          # Auto-fix linting issues
npm run format            # Format code
npm run format:check      # Check code formatting
```

### Keep Your Fork Updated

Before starting new work, always sync with upstream:

```bash
# Pull latest changes from upstream
git fetch upstream
git checkout main
git merge upstream/main

# Update your feature branch (if needed)
git checkout feature/your-feature-name
git rebase main
```

---

## 🧪 Local Testing & Debugging

### Load Plugin in Logseq

1. Build the plugin:
```bash
npm run build
```

2. Load in Logseq:
   - Open Logseq
   - Go to `Settings` → `Plugins` → `Load unpacked plugin`
   - Select the plugin directory

3. Test the plugin:
   - Type `/` in a block
   - Select `MMarked Block`
   - Enter markdown content in the code block below

### Debugging Tips

- Check the browser console for debug logs (prefixed with `[MMarked Debug]` or `[MMarked Error]`)
- Use `logseq.UI.showMsg()` for user-facing notifications
- Enable source maps in `rollup.config.js` if needed for debugging
- Use browser DevTools to inspect rendered content

---

## 📦 Release Process

### For Maintainers

#### Quick Release (Automated)

```bash
# Make sure you're on main branch with no uncommitted changes
./scripts/release.sh 1.4.0
```

This script will:
- Update `package.json` version
- Run lint and build checks
- Commit the version bump
- Create and push a git tag
- Trigger GitHub Actions for automatic release

#### Manual Release

1. Update version in `package.json`:
```json
{
  "version": "1.4.0"
}
```

2. Commit changes:
```bash
git add package.json
git commit -m "chore: bump version to 1.4.0"
```

3. Create and push tag:
```bash
git tag v1.4.0
git push origin v1.4.0
```

4. GitHub Actions will automatically:
   - Build the plugin
   - Create a GitHub Release
   - Upload the plugin zip file


## 🎨 Code Style

### Code Quality Tools

We use ESLint and Prettier for consistent code style. Before committing:

```bash
# Check code style
npm run lint
npm run format:check

# Auto-fix issues
npm run lint:fix
npm run format
```

### Style Guidelines

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use meaningful variable names
- Add JSDoc comments for public APIs
- Follow existing code patterns

---

## 📝 Commit Guidelines

### Commit Message Format

```
type(scope): subject

body

footer
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Test additions or changes
- `chore`: Build process or auxiliary tool changes

Examples:
```
feat: add support for custom themes
fix: resolve rendering issue with nested blocks
docs: update README with new API usage
```

## Submitting Changes

1. Ensure all tests pass and code is formatted:
```bash
npm run lint
npm run format:check
npm run build
```

2. Commit your changes:
```bash
git add .
git commit -m "feat: your feature description"
```

3. Push to your fork:
```bash
git push origin feature/your-feature-name
```

4. Create a Pull Request:
   - Go to the original repository on GitHub
   - Click "New Pull Request"
   - Select your fork and branch
   - Fill in the PR template
   - Submit the PR

## Code Review Process

- All PRs require review from at least one maintainer
- Address review comments by pushing additional commits
- Once approved, a maintainer will merge your PR

## Reporting Issues

When reporting issues, please include:

1. **Environment**:
   - Logseq version
   - Plugin version
   - Operating system
   - Browser (if relevant)

2. **Steps to reproduce**:
   - Detailed steps to trigger the issue
   - Expected behavior
   - Actual behavior

3. **Screenshots or logs** (if applicable)

## Feature Requests

Feature requests are welcome! Please:

1. Check if the feature already exists or is planned
2. Clearly describe the use case
3. Explain how it benefits users
4. Provide examples if possible

## Questions?

- Open an issue for technical questions
- Join our [Discord](https://discord.gg/6VMUVA5Yq2) for discussions
- Check existing issues and documentation

---

## 🔧 Technical Details

### Dependencies

- **Runtime**: None (all bundled)
- **Peer Dependencies**: `@logseq/libs >= 0.2.0`
- **Bundled Library**: `@mathcrowd/mmarked` (included as `src/browser.umd.js`)

### Architecture

- **Entry Point**: `src/index.ts`
- **Build Tool**: Rollup 4
- **Output Format**: IIFE (Immediately Invoked Function Expression)
- **TypeScript**: 5.x with strict mode

### Performance Optimizations

- **DOMParser Reuse**: Single instance for all parsing operations
- **Render Cache**: LRU cache (max 100 entries) for rendered content
- **Hash-based Caching**: MD5 hashing for cache keys

### Project Structure

```
mmarked-logseq-extension/
├── src/
│   ├── index.ts              # Main plugin entry point
│   ├── marked.d.ts           # TypeScript declarations
│   └── browser.umd.js        # Bundled mmarked library (2.7MB)
├── scripts/
│   ├── release.sh            # Automated GitHub release
│   ├── (removed) prepare-marketplace.sh # Deprecated marketplace helper (no longer needed)
│   └── commit-all.sh         # Batch commit helper
├── dist/                     # Build output (generated)
├── .github/workflows/        # GitHub Actions
├── package.json              # Dependencies and scripts
├── rollup.config.js          # Build configuration
├── tsconfig.json             # TypeScript configuration
├── eslint.config.js          # ESLint rules
├── .prettierrc.json          # Code formatting rules
└── README.md                 # User documentation
```

---

## 📞 Questions?

- Open an issue for technical questions
- Join our [Discord](https://discord.gg/6VMUVA5Yq2) for discussions
- Check existing issues and documentation

---

## 📄 License

By contributing, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

Thank you for contributing! 🎉
