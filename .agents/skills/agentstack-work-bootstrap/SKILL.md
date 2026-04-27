---
name: agentstack-work-bootstrap
description: >
  Use when an agent must prepare an isolated branch, worktree, or workspace for a claimed work item.
license: MIT
compatibility: >
  AgentStack Protocol repository layout with .agent-stack as the canonical source of truth.
metadata:
  project: agentstack-protocol
  version: "0.1.0"
  tags: "agentstack-protocol backlog autonomous-agents"
allowed-tools: Read Bash(git:*) Bash(gh:*) Bash(az:*)
---

# Work Bootstrap

## Procedure

1. Confirm the item is claimed by this agent.
2. Create or switch to an isolated branch/worktree.
3. Record workspace and branch details in the local protocol log.
4. Do not modify unrelated files before a plan exists.

