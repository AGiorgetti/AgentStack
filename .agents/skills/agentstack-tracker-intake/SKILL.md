---
name: agentstack-tracker-intake
description: >
  Use when an agent must find or select a tracker work item that is eligible for autonomous execution under AgentStack Protocol.
license: MIT
compatibility: >
  AgentStack Protocol repository layout with .agent-stack as the canonical source of truth.
metadata:
  project: agentstack-protocol
  version: "0.1.0"
  tags: "agentstack-protocol backlog autonomous-agents"
allowed-tools: Read Bash(git:*) Bash(gh:*) Bash(az:*)
---

# Tracker Intake

## Procedure

1. Use `agentstack-backlog-language` to identify the active tracker and mapping.
2. Query candidate work items using the active tracker adapter or CLI.
3. Keep only items with `executionMode = agent` and `readyForAgent = true`.
4. Exclude items with active claims or unresolved blockers.
5. Return the best candidate with an eligibility rationale.

## Stop conditions

- No eligible item exists.
- Required mapping or tracker data is missing.

