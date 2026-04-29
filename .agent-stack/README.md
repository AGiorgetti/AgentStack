# AgentStack Protocol assets

This folder contains the repository-local AgentStack Protocol assets consumed by AI agents and the global `agentstack` CLI.

## Contents

- `active-tracker.json`: selects the active tracker and points to its config/mapping.
- `protocol/AGENT-PROTOCOL.md`: collaboration protocol, states, events, and review submission rules.
- `language/backlog-language.yaml`: canonical backlog vocabulary and DDD-style ubiquitous delivery language.
- `trackers/<tracker>.mapping.yaml`: tracker-specific dictionary from native tracker concepts to canonical concepts.
- `trackers/<tracker>.config.json`: repository-specific tracker connection/configuration. This file must not contain placeholders.
- `policy/AGENT-POLICY.json`: execution policy gates for autonomous agents.

## Policy

`.agent-stack/policy/AGENT-POLICY.json` is the repository-local execution policy. The CLI loads it for workflow decisions and falls back to built-in recommended defaults if it is missing.

Policy fields:

- `requireAcceptanceCriteria`: used by `work-item graph` and `work-item claim` when calculating whether an item can start. If true, claim requires parsed acceptance criteria unless `--force` is used.
- `requireHumanReviewBeforeMerge`: reported by `work-item submit-review` as `reviewRequired`.

## CLI Help

The CLI is the source of truth for AgentStack command contracts.

Use:

```sh
agentstack help
agentstack help work-item claim
agentstack work-item claim --help
```

For agent and tool consumption, prefer machine-readable help:

```sh
agentstack help --json
agentstack help work-item claim --json
agentstack help work-item submit-review --json
```

AgentStack skills should reference `agentstack help ... --json` for current flags, output, examples, and policy effects instead of duplicating full command manuals.

## Skills

Skills do **not** live under `.agent-stack`.

AgentStack skills live only under:

```text
.agents/skills/agentstack-*/SKILL.md
```

The `agentstack-` prefix reduces naming collisions with other skill packages. Because apparently even folders need namespaces now.

## Generic agent entrypoint

`AGENTS.md` is the generic agent entrypoint. Setup merges an AgentStack-managed block into existing `AGENTS.md` files instead of overwriting them.
