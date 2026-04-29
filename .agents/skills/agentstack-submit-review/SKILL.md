---
name: agentstack-submit-review
description: >
  Use when an agent has completed implementation and must submit the work for human review.
license: MIT
compatibility: >
  AgentStack Protocol repository layout with .agent-stack as the canonical source of truth.
metadata:
  project: agentstack-protocol
  version: "0.1.0"
  tags: "agentstack-protocol backlog autonomous-agents"
allowed-tools: Read Bash(git:*) Bash(gh:*) Bash(az:*)
---

# Submit Review

## CLI reference

Use `agentstack help work-item submit-review --json` for the current review submission command syntax, output shape, and policy effects.

## Procedure

1. Verify validation results.
2. Open or update the pull request.
3. Link the PR to the work item.
4. Summarize changes, tests, risks, and known limitations.
5. Set protocol state to `pr-open` or `in-review`.

## Rules

- Do not self-approve.
- Do not close the work item unless policy explicitly allows it.
