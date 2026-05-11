# Protocol Assets

Deployable protocol source assets live under:

```text
assets/modules/protocol/
assets/modules/protocol/skills/
assets/root/agent-stack.gitignore
```

The protocol module installs module-owned assets into target repositories under:

```text
.agent-stack/modules/protocol/
  active-tracker.json
  README.md
  PROMPTS.md
  workspace.json
  protocol/AGENT-PROTOCOL.md
  language/backlog-language.yaml
  policy/AGENT-POLICY.json
  trackers/<active-tracker>.mapping.yaml
  trackers/<active-tracker>.config.json
  templates/markdown-style.md
```

Protocol skills are installed under:

```text
.agents/skills/agentstack-protocol-*/SKILL.md
.agents/skills/git-worktree-ops/SKILL.md
```

Shared runtime remains at:

```text
.agent-stack/local/
.agent-stack/runs/
```
