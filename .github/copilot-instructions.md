# Copilot Instructions for AgentStack

## Repository Overview

**AgentStack** is an npm CLI tool written in TypeScript that scaffolds repositories with vendor-neutral placeholder files and optional vendor-specific packs (GitHub, VS Code, Claude, Codex). The tool uses strict JSON templates with placeholder strings and supports managed Markdown blocks for updating existing files.

- **Type**: npm CLI tool / scaffolding utility
- **Language**: TypeScript (ES2022, ES Modules)
- **Size**: Small (~5 TypeScript files, ~200 lines each)
- **Runtime**: Node.js v18+ (tested with v24.13.0)
- **Package Manager**: npm 9+ (tested with 11.6.2)

## Build & Test Commands

### Bootstrap (First Time Setup)
```bash
npm install
```
**IMPORTANT**: If build fails with "Cannot find module 'node:path'" errors, you need to install @types/node:
```bash
npm install --save-dev @types/node
```

### Build
```bash
npm run build
```
- Uses TypeScript compiler (`tsc`)
- Outputs to `dist/` directory
- Takes ~2-5 seconds
- The `dist/` directory is gitignored and should NOT be committed

### Lint
```bash
npm run lint
```
- Runs TypeScript compiler with `--noEmit` flag for type checking only
- Takes ~2-5 seconds

### Run CLI During Development
```bash
npm start -- <command> [options]
```
Examples:
```bash
npm start -- list
npm start -- init --vendors github --dry-run --template-dir src/templates
npm start -- doctor --vendors github --template-dir src/templates
```

### Run Built CLI
After building, the CLI can be invoked with:
```bash
node dist/bin.js <command> [options]
```

**Note**: There are NO automated tests in this repository. Manual validation is required by running the CLI commands.

## Project Structure

```
/
├── src/                        # TypeScript source code
│   ├── bin.ts                  # CLI entry point, argument parsing
│   ├── index.ts                # Public API exports
│   ├── core/                   # Core logic
│   │   ├── engine.ts           # Pack discovery, planning, apply logic
│   │   ├── filesystem.ts       # File operations helpers
│   │   ├── merge.ts            # Managed block merging (TEMPLATE:BEGIN/END)
│   │   └── types.ts            # TypeScript type definitions
│   └── templates/              # Template files (copied to target repos)
│       ├── neutral/            # Vendor-neutral templates (AGENTS.md, CONTEXT.md)
│       │   └── pack.json       # Pack metadata
│       └── vendors/            # Vendor-specific template packs
│           ├── github/         # GitHub-specific templates
│           ├── vscode/         # VS Code settings
│           ├── claude/         # Claude AI instructions
│           └── codex/          # Codex instructions
├── dist/                       # Build output (GITIGNORED, do not commit)
├── package.json                # npm package config, scripts
├── tsconfig.json               # TypeScript compiler config
├── .gitignore                  # Git ignore rules (includes dist/, node_modules/, package-lock.json)
└── README.md                   # User documentation
```

### Key Files

- **src/bin.ts**: CLI argument parsing, command routing (list, init, add, doctor)
- **src/core/engine.ts**: Core scaffolding logic - pack discovery, file planning, and application
- **src/core/merge.ts**: Managed block parsing and merging for Markdown files (uses `<!-- TEMPLATE:BEGIN id -->` / `<!-- TEMPLATE:END id -->` markers)
- **src/templates/**: Templates are NOT copied to dist/; CLI resolves them relative to built code location or via `--template-dir` flag

## CLI Commands

### `agentstack list`
Lists all available packs (neutral + vendors).

### `agentstack init`
Initialize a new repository with neutral + selected vendor packs.
- **Flags**: `--vendors <list>`, `--all`, `--no-neutral`, `--force`, `--managed-blocks`, `--dry-run`, `--interactive`

### `agentstack add <vendor>`
Add vendor packs to an existing repository.
- Positional vendor argument or `--vendors` flag

### `agentstack doctor`
Validate that expected files exist and managed blocks are not malformed.
- Returns exit code 1 for warnings, 2 for errors

## Common Issues & Workarounds

### Issue: Build fails with "Cannot find module 'node:path'"
**Cause**: Missing @types/node dependency  
**Fix**: Run `npm install --save-dev @types/node` before building

### Issue: CLI shows "Vendor pack 'X' not found"
**Cause**: Templates not found relative to dist/bin.js location  
**Fix**: Use `--template-dir src/templates` flag when running from development environment, or use `npm start --` instead of `node dist/bin.js`

### Issue: npx agentstack fails with "import: not found"
**Cause**: The package is not published to npm yet; dist/ contains raw JS modules  
**Fix**: Use `npm start --` for development or `node dist/bin.js` for built version

## Code Conventions

- **ES Modules**: All code uses ES module syntax (`import`/`export`)
- **TypeScript**: Strict mode enabled, all types must be explicit
- **No comments in JSON**: Templates use strict JSON (no comments or trailing commas)
- **Managed blocks**: Markdown files use `<!-- TEMPLATE:BEGIN id -->` / `<!-- TEMPLATE:END id -->` markers for vendor-specific sections
- **Placeholder format**: Use uppercase `TODO` or `REPLACE_WITH_*` for placeholders in templates
- **File strategy**: Default is "create if missing"; `--force` overwrites; `--managed-blocks` updates specific sections

## Validation Steps

Before finalizing changes:

1. **Clean build from scratch**:
   ```bash
   rm -rf dist/ node_modules/
   npm install
   npm run build
   npm run lint
   ```

2. **Test CLI commands**:
   ```bash
   npm start -- list
   npm start -- init --vendors github --dry-run --template-dir src/templates
   npm start -- doctor --vendors github --template-dir src/templates
   ```

3. **Verify no build artifacts committed**:
   - Check that `dist/`, `node_modules/`, and `package-lock.json` are gitignored
   - Run `git status` to ensure they're not staged

## Important Notes

- **No CI/CD**: This repository has no GitHub Actions workflows or automated checks yet
- **No tests**: Manual validation only
- **Templates location**: Templates in `src/templates/` must mirror target file paths (e.g., `src/templates/vendors/github/.github/copilot-instructions.md` → `.github/copilot-instructions.md` in target repo)
- **Pack discovery**: Packs are discovered by finding `pack.json` files in `neutral/` and `vendors/*/` subdirectories
- **Memory**: Managed Markdown blocks use delimiters `<!-- TEMPLATE:BEGIN <id> -->` and `<!-- TEMPLATE:END <id> -->`

## Files in Repository Root

- `LICENSE`: MIT license
- `README.md`: User-facing documentation
- `package.json`: npm package metadata and scripts
- `tsconfig.json`: TypeScript compiler configuration
- `.gitignore`: Includes Visual Studio patterns plus `dist/`, `node_modules/`, `package-lock.json`

## Making Code Changes

1. **Always run `npm install` first** if package.json changed
2. **Build immediately after code changes**: `npm run build`
3. **Test the CLI** with `npm start --` commands
4. **Run lint** before committing: `npm run lint`
5. **Never commit** `dist/`, `node_modules/`, or `package-lock.json`
6. When adding new vendor packs, mirror the target file structure in `src/templates/vendors/<vendor>/`
7. When modifying managed block logic, test with `--managed-blocks` flag

## Trust These Instructions

The commands and information in this document have been validated. Only search for additional information if:
- You encounter an error not described here
- You need details about a specific template file's contents
- You're implementing a new feature not covered by existing patterns
