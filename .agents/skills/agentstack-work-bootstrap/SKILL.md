---
name: agentstack-work-bootstrap
description: >
  Use when an agent must prepare an isolated branch, worktree, or workspace for a claimed work item.
compatibility: >
  AgentStack Protocol repository layout with .agent-stack as the canonical source of truth.
metadata:
  project: agentstack-protocol
  version: "0.1.0"
  tags: "agentstack-protocol backlog autonomous-agents"
allowed-tools: Read Bash(git:*) Bash(gh:*) Bash(az:*)
---

# Work Bootstrap

## CLI reference

Use `agentstack help work-item claim --json` to inspect claim metadata fields that may need to be carried into branch or workspace naming.

## When to use

Use this skill after claim and before planning or implementation when an isolated branch, worktree, or workspace is needed.

## Commands

1. Run `agentstack work-item get <id>` to confirm the active claim.
2. Use repository-native git commands to create or switch to the branch/worktree.
3. If claim metadata needs to include branch/workspace, provide it when claiming: `agentstack work-item claim <id> --agent <agent-id> --branch <name> --workspace <path>`.

## Decision rules

- Bootstrap only work claimed by this agent.
- Use deterministic branch/workspace names that include the work item id.
- Do not modify source files before the plan is recorded.

## Stop or escalate

- Stop if the item is unclaimed or claimed by another agent.
- Stop if branch/worktree setup would overwrite unrelated local changes.

## Example

```sh
agentstack work-item claim 123 --agent codex-01 --branch agentstack/123 --workspace ../worktrees/123
```
