# Rules Assets

The rules module source template contains AgentStack's current built-in rules. Its content and internal format may evolve between versions.

Source asset:

```text
assets/modules/rules/rules.md
```

Shared file modified by the module:

```text
AGENTS.md
```

The module owns only the content between:

```text
<!-- as:rules -->
<!-- /as:rules -->
```

The managed block must remain at the absolute top of root `AGENTS.md`.

Setup injects the source template verbatim without copying it into `.agent-stack/`. The lifecycle implementation must not depend on its rule count, headings, or formatting.
