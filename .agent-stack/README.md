# AgentStack Protocol assets

This folder contains the repository-local AgentStack Protocol assets consumed by AI agents and the global `agentstack` CLI.

## Contents

- `active-tracker.json`: selects the active tracker and points to its config/mapping.
- `protocol/AGENT-PROTOCOL.md`: collaboration protocol, states, events, and handoff rules.
- `language/backlog-language.yaml`: canonical backlog vocabulary and DDD-style ubiquitous delivery language.
- `trackers/<tracker>.mapping.yaml`: tracker-specific dictionary from native tracker concepts to canonical concepts.
- `trackers/<tracker>.config.json`: repository-specific tracker connection/configuration. This file must not contain placeholders.
- `policy/AGENT-POLICY.json`: execution policy gates for autonomous agents.

## Skills

Skills do **not** live under `.agent-stack`.

AgentStack skills live only under:

```text
.agents/skills/agentstack-*/SKILL.md
```

The `agentstack-` prefix reduces naming collisions with other skill packages. Because apparently even folders need namespaces now.

## Generic agent entrypoint

`AGENTS.md` is the generic agent entrypoint. Setup merges an AgentStack-managed block into existing `AGENTS.md` files instead of overwriting them.
