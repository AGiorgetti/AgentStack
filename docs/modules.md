# Modules

AgentStack modules are built-in packages of CLI commands, repository assets, skills, setup logic, and uninstall logic.

## Built-In Modules

| Module | Status | Purpose |
| --- | --- | --- |
| `protocol` | implemented | Installs AgentStack Protocol assets and activates tracker-backed autonomous work commands. |
| `rules` | implemented | Installs AgentStack's built-in rules template into a managed block at the top of root `AGENTS.md`. |

## Module Contract

Each module owns:

- setup procedure;
- uninstall procedure;
- status reporting;
- owned asset paths;
- command help metadata;
- validation docs and tests.

Shared paths must be declared and preserved by uninstall unless the caller explicitly requests runtime purging and no other installed module needs them.

## Repository Manifest

Installed modules are tracked in:

```text
.agent-stack/modules.json
```

Example:

```json
{
  "modules": {
    "protocol": {
      "installedAt": "2026-05-11T00:00:00.000Z",
      "version": "0.1.1",
      "activeTracker": "github"
    }
  }
}
```
