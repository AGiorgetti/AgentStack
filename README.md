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
| [Rules Module](docs/modules/rules/README.md) | Repository rules module. |

## Built-in Modules

AgentStack includes several built-in modules that can be installed into a repository. Available modules in this source tree:

- `protocol`: Tracker-backed collaboration protocol for humans and AI agents. Installs protocol assets under `.agent-stack/modules/protocol/` and provides `work-item`, `agent`, and protocol-related commands.
- `rules`: Repository rules module that manages policy and validation rules for repository health.

To list all built-in modules (installed or not) use:

```sh
agentstack module available
```

To list installed modules in a repository use:

```sh
agentstack module list --repo /path/to/product-repo
```

Setup instructions per module

- Protocol: (GitHub)

```sh
agentstack setup protocol \
  --target /path/to/product-repo \
  --tracker github \
  --github-repository OWNER/REPO \
  --agents generic \
  --provision-tracker \
  --overwrite
```

- Protocol: (Azure DevOps)

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

- Rules:

```sh
agentstack setup rules --target /path/to/product-repo
```


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

Install dependencies and run the validation loop:

```sh
npm install
npm run build
npm run typecheck
npm test
npm pack --dry-run
```

Expose this checkout as the global `agentstack` command without publishing:

```sh
npm install
npm run build
npm link
agentstack --help
```

After changing TypeScript source, rebuild:

```sh
npm run build
```

Run the built CLI directly when testing specific changes:

```sh
node ./dist/agentstack.js --help
node ./dist/agentstack.js help setup --json
node ./dist/agentstack.js setup protocol --target ./tmp-agentstack-target --tracker github --github-repository OWNER/REPO --overwrite
node ./dist/agentstack.js doctor --repo ./tmp-agentstack-target
node ./dist/agentstack.js uninstall protocol --target ./tmp-agentstack-target --purge-runtime
```

To remove the global link:

```sh
npm unlink -g @agentstack/cli
```

To use AgentStack to develop AgentStack itself, install the protocol module into this checkout:

```sh
node ./dist/agentstack.js setup protocol --target . --tracker github --github-repository OWNER/REPO --overwrite
node ./dist/agentstack.js doctor --repo .
```

Deployable source assets live under `assets/`, so self-install does not overwrite package source templates.

For contributor and agent internals, see [Architecture](docs/architecture.md) and [Development](docs/development.md).
```
