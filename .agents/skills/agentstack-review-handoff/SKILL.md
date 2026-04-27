---
name: agentstack-review-handoff
description: >
  Use when an agent has completed implementation and must open a pull request or hand work back to a human reviewer.
license: MIT
compatibility: >
  AgentStack Protocol repository layout with .agent-stack as the canonical source of truth.
metadata:
  project: agentstack-protocol
  version: "0.1.0"
  tags: "agentstack-protocol backlog autonomous-agents"
allowed-tools: Read Bash(git:*) Bash(gh:*) Bash(az:*)
---

# Review Handoff

## Procedure

1. Verify validation results.
2. Open or update the pull request.
3. Link the PR to the work item.
4. Summarize changes, tests, risks, and known limitations.
5. Set protocol state to `pr-open` or `in-review`.

## Rules

- Do not self-approve.
- Do not close the work item unless policy explicitly allows it.

