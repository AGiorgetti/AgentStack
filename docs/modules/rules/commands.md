# Rules Commands

## `agentstack setup rules`

```sh
agentstack setup rules [--target <repo>]
```

Behavior:

- writes its contents inside the rules-managed block at the top of root `AGENTS.md`;
- preserves content outside the managed block;
- records the module in `.agent-stack/modules.json`.

Setup always refreshes an existing valid rules-managed block from the built-in template.

## `agentstack uninstall rules`

```sh
agentstack uninstall rules [--target <repo>]
```

Behavior:

- removes the `rules` entry from `.agent-stack/modules.json`;
- removes only the rules-managed block from root `AGENTS.md`;
- preserves unrelated repository instructions and other modules.

## Module Inspection

```sh
agentstack module status rules [--repo <repo>]
agentstack module list [--repo <repo>]
```
