# AgentStack Protocol

AgentStack Protocol defines a collaboration protocol and workflow toolkit for humans and AI agents implementing backlog-driven software work.

It is intentionally tracker-independent. Agents reason in canonical terms, then use a tracker mapping dictionary to translate those terms into GitHub Issues, Azure DevOps Work Items, or future tracker concepts.

## Core idea

```text
protocol at the core
workflow at runtime
ubiquitous language at the boundary
tracker dictionary at the integration layer
skills at .agents/skills
```

## Canonical work item types

- `epic`
- `feature`
- `story`
- `task`
- `bug`
- `spike`

`portfolio-item` is deliberately excluded. Strategic portfolio structures can be mapped outside this protocol if a team needs them. Let us not smuggle enterprise taxonomy into a delivery protocol just because some tool can display another level of nesting.

## Canonical states

- `draft`
- `ready`
- `claimed`
- `implementing`
- `blocked`
- `pr-open`
- `in-review`
- `done`
- `abandoned`

## Canonical relations

- `parent`
- `child`
- `blocks`
- `blocked-by`
- `related`

## Collaboration rules

1. Humans decide when a work item is ready for agent implementation.
2. Agents may only claim work explicitly mapped to `executionMode = agent` and `readyForAgent = true`.
3. Agents must check dependency relations before implementation.
4. Agents must create an execution plan before coding.
5. Agents must synchronize meaningful progress back to the tracker.
6. Agents must stop and raise a blocker instead of guessing through ambiguity.
7. Agents open a PR and hand work back to humans unless policy explicitly says otherwise.
8. Humans decide merge and final closure by default.

## Runtime workflow

```text
load language -> intake -> claim -> graph -> bootstrap -> plan -> implement -> sync -> handoff
```

The workflow is executed through skills under `.agents/skills/agentstack-*/SKILL.md`.

## Skill naming

All AgentStack Protocol skills must:

- live only under `.agents/skills/`
- use a directory named `agentstack-<skill-name>`
- contain a `SKILL.md` file
- have frontmatter `name` matching the directory name
- start with the `agentstack-` prefix to avoid collisions with other skill packages

## Deployable repository footprint

A real repository should contain only the active tracker mapping and config.

```text
AGENTS.md
.agent-stack/
  README.md
  active-tracker.json
  protocol/AGENT-PROTOCOL.md
  language/backlog-language.yaml
  policy/AGENT-POLICY.json
  trackers/<active-tracker>.mapping.yaml
  trackers/<active-tracker>.config.json
.agents/
  skills/
    agentstack-*/SKILL.md
```

Optional vendor shims such as `CLAUDE.md`, `GEMINI.md`, and `.github/copilot-instructions.md` may be added, but `AGENTS.md` remains the generic entrypoint.

## Local execution files

If local machine-readable runtime state is needed, store it under:

```text
.agent-stack/runs/<work-item-id>/
  protocol-state.json
  protocol-log.jsonl
  execution-plan.json
  handoff-summary.md
```

Do not use `.agent-stack/skills`; skills belong only in `.agents/skills`.

## Tracker profiles

Use `.agent-stack/install/setup-agent-stack.mjs` or the package CLI to deploy a selected tracker profile. Do not deploy inactive tracker mappings into ordinary product repositories unless the repository intentionally uses multiple backlog trackers.
