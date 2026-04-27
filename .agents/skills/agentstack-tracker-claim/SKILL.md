---
name: agentstack-tracker-claim
description: >
  Use when an agent must exclusively claim an eligible work item before planning or implementation.
license: MIT
compatibility: >
  AgentStack Protocol repository layout with .agent-stack as the canonical source of truth.
metadata:
  project: agentstack-protocol
  version: "0.1.0"
  tags: "agentstack-protocol backlog autonomous-agents"
allowed-tools: Read Bash(git:*) Bash(gh:*) Bash(az:*)
---

# Tracker Claim

## Procedure

1. Re-read the target work item.
2. Verify it is still eligible and unclaimed.
3. Generate a claim token.
4. Update protocol state to `claimed`.
5. Persist the claim in the tracker and local protocol log.

## Rules

- One active claim per work item.
- If claim creation is ambiguous or races, stop and raise a blocker.

