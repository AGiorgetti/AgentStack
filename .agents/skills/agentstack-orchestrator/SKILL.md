---
name: agentstack-orchestrator
description: >
  Use when an autonomous agent needs to decide which AgentStack Protocol skill to invoke next while executing backlog-driven software work.
license: MIT
compatibility: >
  AgentStack Protocol repository layout with .agent-stack as the canonical source of truth.
metadata:
  project: agentstack-protocol
  version: "0.1.0"
  tags: "agentstack-protocol backlog autonomous-agents"
allowed-tools: Read Bash(git:*) Bash(gh:*) Bash(az:*)
---

# Orchestrator

## CLI reference

Use `agentstack help --json` for the full command catalog and `agentstack help <command> --json` for the current command contract before invoking workflow commands.

## Procedure

1. Load `.agent-stack/README.md`.
2. Load `.agent-stack/protocol/AGENT-PROTOCOL.md`.
3. Load `.agent-stack/policy/AGENT-POLICY.json`.
4. Use `agentstack-backlog-language` to load the canonical language and active tracker mapping.
5. Invoke the workflow skills in order: `agentstack-tracker-intake`, `agentstack-tracker-claim`, `agentstack-tracker-graph`, `agentstack-work-bootstrap`, `agentstack-work-plan`, `agentstack-work-implement`, `agentstack-tracker-sync`, `agentstack-submit-review`.
6. Invoke `agentstack-blocker-handling` whenever safe progress is impossible.

## Rules

- Never skip claim before implementation.
- Never implement blocked work.
- Never close work unless policy explicitly allows it.
