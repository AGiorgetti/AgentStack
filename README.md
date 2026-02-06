# AgentStack

AgentStack is an npm CLI that initializes a repository with vendor-neutral placeholder files and optional vendor packs. It uses strict JSON templates (no comments or metadata) and defaults to create-if-missing behavior.

## Quick start

```bash
npm install
npm run build
npx agentstack list
npx agentstack init --vendors vscode,github
```

## Commands

- `agentstack list`: list available packs.
- `agentstack init`: initialize with neutral + selected vendor packs.
- `agentstack add <vendor>`: add one or more vendor packs to an existing repo.
- `agentstack doctor`: validate expected files and managed blocks.

## Common flags

- `--vendors <comma-list>`: select vendor packs.
- `--all`: select all vendors.
- `--neutral` / `--no-neutral`: enable or disable neutral pack.
- `--template-dir <path>`: override built-in templates.
- `--force`: overwrite existing files.
- `--managed-blocks`: enable managed Markdown blocks.
- `--dry-run`: print plan without writing.
- `--interactive`: prompt for vendor selection.

## Core rules

- No repo configuration file is stored.
- JSON templates are strict JSON with placeholder strings.
- Default behavior: create files only if missing.
- `--force` overwrites existing files.
- `--managed-blocks` updates Markdown files by managed blocks.

## Templates layout

```
src/templates/
  neutral/
    AGENTS.md
    CONTEXT.md
    pack.json

  vendors/
    vscode/
      .vscode/
        extensions.json
        settings.json
        mcp.json
      pack.json

    github/
      .github/
        pull_request_template.md
        ISSUE_TEMPLATE/
          bug_report.yml
          feature_request.yml
        workflows/
          ci.yml
        copilot-instructions.md
      pack.json

    claude/
      .claude/
        README.md
        instructions.md
      pack.json

    codex/
      .codex/
        README.md
        instructions.md
      pack.json
```

Templates must mirror their target file paths. Pack discovery is based on `neutral/pack.json` and `vendors/*/pack.json`.
