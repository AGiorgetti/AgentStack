# Rules Uninstall

```sh
agentstack uninstall rules
```

Uninstall removes:

- the `rules` entry in `.agent-stack/modules.json`;
- the rules-managed block in root `AGENTS.md`.

Uninstall preserves:

- unrelated root `AGENTS.md` content;
- managed blocks owned by other modules;
- nested `AGENTS.md` files;
- shared AgentStack runtime;
- other installed modules and their assets.

If removing the managed block leaves root `AGENTS.md` empty, uninstall may remove the empty file.
