---
name: agentstack-work-implement
description: >
  Use when an agent has a claim and execution plan and must implement scoped code changes with validation.
license: MIT
compatibility: >
  AgentStack Protocol repository layout with .agent-stack as the canonical source of truth.
metadata:
  project: agentstack-protocol
  version: "0.1.0"
  tags: "agentstack-protocol backlog autonomous-agents"
allowed-tools: Read Bash(git:*) Bash(gh:*) Bash(az:*)
---

# Work Implement

## Procedure

1. Follow the execution plan.
2. Keep changes inside the claimed scope.
3. Add or update tests where appropriate.
4. Run validation commands available in the repo.
5. Synchronize meaningful progress with tracker-sync.

## Rules

- Do not broaden scope silently.
- Do not continue after validation failures that require human decisions.

