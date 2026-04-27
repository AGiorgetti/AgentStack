# AgentStack CLI Repository Instructions

This repository contains the source for `@agentstack/cli` and AgentStack Protocol assets.

For tracker-backed work, agents must use the `agentstack` CLI as the canonical interface instead of parsing GitHub or Azure DevOps directly.

Important locations:

- `.agent-stack/README.md`
- `.agent-stack/protocol/AGENT-PROTOCOL.md`
- `.agent-stack/language/backlog-language.yaml`
- `.agent-stack/policy/AGENT-POLICY.json`
- `.agents/skills/agentstack-*/SKILL.md`

Skills live only under `.agents/skills`, and every AgentStack skill starts with `agentstack-`.

The setup process must preserve existing repository instructions by merging an AgentStack-managed block into `AGENTS.md`, not by replacing the whole file.
