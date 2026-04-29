---
name: agentstack-tracker-sync
description: >
  Use when an agent must keep tracker protocol state, progress comments, PR links, and local execution state aligned.
license: MIT
compatibility: >
  AgentStack Protocol repository layout with .agent-stack as the canonical source of truth.
metadata:
  project: agentstack-protocol
  version: "0.1.0"
  tags: "agentstack-protocol backlog autonomous-agents"
allowed-tools: Read Bash(git:*) Bash(gh:*) Bash(az:*)
---

# Tracker Sync

## CLI reference

Use `agentstack help work-item progress --json`, `agentstack help work-item state --json`, `agentstack help work-item block --json`, and `agentstack help work-item submit-review --json` for the current sync command contracts.

## Procedure

1. Write concise progress updates after meaningful milestones.
2. Update protocol state only through valid transitions.
3. Attach PR links when available.
4. Record blockers immediately.
5. Keep local protocol log and tracker state consistent.
