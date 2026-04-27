---
name: agentstack-blocker-handling
description: >
  Use when an agent must stop unsafe execution and publish the smallest useful blocker record needed for a human or dependency to unblock work.
license: MIT
compatibility: >
  AgentStack Protocol repository layout with .agent-stack as the canonical source of truth.
metadata:
  project: agentstack-protocol
  version: "0.1.0"
  tags: "agentstack-protocol backlog autonomous-agents"
allowed-tools: Read Bash(git:*) Bash(gh:*) Bash(az:*)
---

# Blocker Handling

## Procedure

1. State exactly what prevents progress.
2. Separate missing information, unresolved dependency, tool failure, and validation failure.
3. Record completed work and current branch/workspace.
4. Update protocol state to `blocked`.
5. Ask for the smallest decision or dependency resolution needed to resume.

## Rules

- Do not guess through ambiguity.
- Do not mark blocked work as done.

