# Protocol Uninstall

```sh
agentstack uninstall protocol
```

Default uninstall removes:

- `.agent-stack/modules/protocol/`
- `.agents/skills/agentstack-protocol-*`
- the protocol entry in `.agent-stack/modules.json`
- the protocol managed block in `AGENTS.md`

Default uninstall preserves:

- `.agent-stack/local/`
- `.agent-stack/runs/`
- unrelated `AGENTS.md` content
- shared skills such as `git-worktree-ops`

Use runtime purge only when local identity and claim logs can be removed:

```sh
agentstack uninstall protocol --purge-runtime
```
