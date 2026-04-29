---
name: agentstack-tracker-claim
description: >
  Use when an agent must exclusively claim an eligible work item before planning or implementation.
compatibility: >
  AgentStack Protocol repository layout with .agent-stack as the canonical source of truth.
metadata:
  project: agentstack-protocol
  version: "0.1.0"
  tags: "agentstack-protocol backlog autonomous-agents"
allowed-tools: Read Bash(git:*) Bash(gh:*) Bash(az:*)
---

# Tracker Claim

## CLI reference

Use `agentstack help work-item get --json`, `agentstack help work-item graph --json`, and `agentstack help work-item claim --json` for current flags, output fields, policy effects, and failure shapes.

## When to use

Use this skill immediately before planning or implementation when a specific work item must be claimed by this agent.

## Commands

1. Run `agentstack work-item get <id>`.
2. Run `agentstack work-item graph <id>`.
3. If eligible, run `agentstack work-item claim <id> --agent <agent-id>`.

## Decision rules

- Claim only when `graph.canStart` is true.
- Treat an active claim by another agent as exclusive ownership.
- Use `--force` only for explicit human-approved exceptions or controlled smoke tests.
- Preserve the returned `claim.claimToken`; release and future conflict handling depend on it.

## Stop or escalate

- Stop on `claimed: false`, claim conflict, active claim, blocked dependency, unsupported relation data, or policy failure.
- Escalate when eligibility is ambiguous or the tracker response cannot prove the claim belongs to this agent.

## Example

```sh
agentstack work-item get 123
agentstack work-item graph 123
agentstack work-item claim 123 --agent codex-01
```
