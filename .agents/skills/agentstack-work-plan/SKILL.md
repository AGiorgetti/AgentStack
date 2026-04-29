---
name: agentstack-work-plan
description: >
  Use when an agent must turn normalized tracker context and repository context into a concrete scoped execution plan before coding.
license: MIT
compatibility: >
  AgentStack Protocol repository layout with .agent-stack as the canonical source of truth.
metadata:
  project: agentstack-protocol
  version: "0.1.0"
  tags: "agentstack-protocol backlog autonomous-agents"
allowed-tools: Read Bash(git:*) Bash(gh:*) Bash(az:*)
---

# Work Plan

## CLI reference

Use `agentstack help work-item plan --json` for the current plan command syntax and output contract.

## Procedure

1. Restate the requested outcome.
2. Identify likely impacted code areas.
3. List implementation steps.
4. List validation steps.
5. State risks, assumptions, and scope boundaries.
6. Propose child work items instead of silently broadening scope.

## Escalate when

- Acceptance criteria are absent and the change is ambiguous.
- Dependencies are unresolved.
- The change exceeds the claimed scope.
