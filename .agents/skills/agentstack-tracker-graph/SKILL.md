---
name: agentstack-tracker-graph
description: >
  Use when an agent must inspect parent, child, blocking, blocked-by, and related backlog relationships before work starts or changes scope.
license: MIT
compatibility: >
  AgentStack Protocol repository layout with .agent-stack as the canonical source of truth.
metadata:
  project: agentstack-protocol
  version: "0.1.0"
  tags: "agentstack-protocol backlog autonomous-agents"
allowed-tools: Read Bash(git:*) Bash(gh:*) Bash(az:*)
---

# Tracker Graph

## Procedure

1. Load the active tracker mapping.
2. Read parent, child, blocks, blocked-by, and related relations.
3. Normalize relations into AgentStack Protocol relation types.
4. Identify unresolved blockers.
5. Report graph gaps or unsupported relation mappings as blockers.

