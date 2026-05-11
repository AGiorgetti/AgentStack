# AgentStack CLI

`@agentstack/cli` provides the modular `agentstack` command-line tool. Built-in modules install repository-local assets, skills, and commands for agent workflows.

The first built-in module is `protocol`: a tracker-backed collaboration protocol for humans and AI coding agents working from backlog items.

## Documentation

| Document | Purpose |
| --- | --- |
| [Docs](docs/README.md) | Documentation map. |
| [Command Reference](docs/commands.md) | Global command syntax. |
| [Modules](docs/modules.md) | Built-in module registry and contract. |
| [Protocol Module](docs/modules/protocol/README.md) | Protocol commands, usage, assets, and architecture. |

The CLI help is the source of truth:

```sh
agentstack help
agentstack help setup --json
agentstack help work-item claim --json
```

## Install

```sh
npm install -g @agentstack/cli
```

Requirements:

- Node.js 20 or newer.
- Git for repository setup and worktree-based workflows.
- GitHub CLI (`gh`) for the GitHub tracker profile.
- Azure CLI plus `azure-devops` extension for the Azure DevOps tracker profile.

## Quick Setup

GitHub:

```sh
agentstack setup protocol \
  --target /path/to/product-repo \
  --tracker github \
  --github-repository OWNER/REPO \
  --agents generic \
  --provision-tracker \
  --overwrite
```

Azure DevOps:

```sh
agentstack setup protocol \
  --target /path/to/product-repo \
  --tracker azure-devops \
  --azdo-organization https://dev.azure.com/ORG \
  --azdo-project PROJECT \
  --agents generic \
  --provision-tracker \
  --overwrite
```

After setup:

```sh
agentstack module list --repo /path/to/product-repo
agentstack doctor --repo /path/to/product-repo
```

## Repository Footprint

```text
AGENTS.md
.agent-stack/
  modules.json
  modules/protocol/
  local/
  runs/
.agents/
  skills/agentstack-protocol-*/SKILL.md
  skills/git-worktree-ops/SKILL.md
```

In this source repository, deployable module assets live under `assets/`; `.agent-stack/` and `.agents/` are reserved for installed/runtime state in target repositories.

Uninstall:

```sh
agentstack uninstall protocol --target /path/to/product-repo
```

## Local Development

```sh
npm install
npm run build
npm run typecheck
npm test
```
