# Rules Usage

The module installs the current built-in rules template verbatim. Its content, rule count, and internal formatting may change between AgentStack versions. Repository-specific instructions are not included.

## Install

```sh
agentstack setup rules \
  --target /path/to/product-repo
```

Result:

```text
.agent-stack/
  modules.json
AGENTS.md
```

Root `AGENTS.md` starts with:

```md
<!-- as:rules -->
<current built-in rules template>
<!-- /as:rules -->
```

Existing instructions follow the managed block unchanged.

## Refresh

To refresh installed rules after the built-in template changes:

```sh
agentstack setup rules
```

Setup replaces only the rules-managed block and keeps it at the top of root `AGENTS.md`.

## Uninstall

```sh
agentstack uninstall rules --target /path/to/product-repo
```

Uninstall removes the rules-managed block and manifest entry while preserving unrelated instructions.
