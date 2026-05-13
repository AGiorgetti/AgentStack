# Usage

This guide explains how AgentStack is supposed to be used at the host CLI level and points to module-specific workflow guides.

AgentStack is modular:

1. Install one or more modules into a repository.
2. Use `agentstack module list` or `agentstack module status <module>` to inspect installed modules.
3. Use the commands activated by installed modules.
4. Uninstall modules when their assets should be removed.

The first built-in module is `protocol`, which installs tracker-backed autonomous work commands.

## Install The Protocol Module

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
agentstack language validate --repo /path/to/product-repo
agentstack mapping validate --repo /path/to/product-repo
```

## Installed Footprint

The protocol module installs into target repositories:

```text
AGENTS.md
.agent-stack/
  .gitignore
  modules.json
  modules/protocol/
  local/
  runs/
.agents/
  skills/agentstack-protocol-*/SKILL.md
  skills/git-worktree-ops/SKILL.md
```

In the AgentStack source repository, deployable package assets live under `assets/`. This keeps source files separate from installed target paths, so AgentStack can be used to develop AgentStack itself.

## Uninstall The Protocol Module

```sh
agentstack uninstall protocol --target /path/to/product-repo
```

Default uninstall removes protocol-owned installed assets and preserves shared local runtime. Use `--purge-runtime` only when local identity and run logs can be removed:

```sh
agentstack uninstall protocol --target /path/to/product-repo --purge-runtime
```

## Protocol Workflow

Once protocol is installed, the normal autonomous work sequence is:

```sh
agentstack doctor
agentstack work-item get 123
agentstack work-item graph 123
agentstack agent identity init
agentstack work-item claim 123 --branch agentstack/123 --workspace ../repo-worktrees/123
agentstack work-item plan 123 --message "Implement the scoped behavior and validate it."
agentstack work-item progress 123 --message "Implementation started."
agentstack work-item submit-review 123 --pr https://github.com/OWNER/REPO/pull/456
```

For the full protocol workflow, including policy, worktrees, blockers, review outcomes, smoke tests, and troubleshooting, see [Protocol Usage](modules/protocol/usage.md).
