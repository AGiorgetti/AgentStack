---
name: agentstack-backlog-language
description: >
  Use when an agent must interpret, normalize, create, link, or update backlog items through the repository-specific ubiquitous delivery language and active tracker mapping dictionary.
license: MIT
compatibility: >
  AgentStack Protocol repository layout with .agent-stack as the canonical source of truth.
metadata:
  project: agentstack-protocol
  version: "0.1.0"
  tags: "agentstack-protocol backlog autonomous-agents"
allowed-tools: Read Bash(git:*) Bash(gh:*) Bash(az:*)
---

# Backlog Language

## CLI reference

Use `agentstack help language validate --json` and `agentstack help mapping validate --json` for the current validation command contracts.

## When to use

Use this skill before tracker intake, graph analysis, planning, synchronization, or tracker updates.

## Procedure

1. Read `.agent-stack/language/backlog-language.yaml`.
2. Read only the active tracker mapping from `.agent-stack/trackers/`.
3. Translate tracker-native fields, labels, tags, states, and relations into canonical protocol concepts.
4. Verify that type, readiness, execution mode, protocol state, priority, and relations are explicitly mapped.
5. If a mapping is missing, stop and use the agentstack-blocker-handling skill.

## Hard rules

- Do not infer readiness from prose.
- Do not assume a tracker label, tag, or field has protocol meaning unless the mapping says so.
- Do not load mappings for inactive trackers.
- Do not invent new canonical work item types.
