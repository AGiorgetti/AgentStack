# Command Reference

This reference describes the public command surface. The live source of truth for exact flags and JSON contracts is still the CLI:

```sh
agentstack help
agentstack help setup --json
agentstack help work-item claim --json
```

AgentStack is modular. Global commands install, uninstall, and inspect modules. Installed modules activate additional commands. The `protocol` module activates tracker-backed autonomous work commands such as `doctor`, `agent`, `language`, `mapping`, and `work-item`.

Use `--repo <path>` when running a command from outside the target repository. Use `--target <path>` for setup and uninstall lifecycle commands.

## Global Commands

### `agentstack help`

Shows human-readable or machine-readable command help.

```sh
agentstack help
agentstack help setup
agentstack help setup --json
agentstack help work-item claim --json
```

`--json` returns structured metadata intended for agents and tooling. Human docs explain workflow and intent; help JSON is the exact executable contract.

### `agentstack setup <module>`

Installs a built-in module into a repository.

```sh
agentstack setup protocol --tracker github --github-repository OWNER/REPO [--target <repo>] [--agents generic,claude,copilot,gemini] [--overwrite] [--provision-tracker]

agentstack setup protocol --tracker azure-devops --azdo-organization <url> --azdo-project <project> [--azdo-team <team>] [--target <repo>] [--agents generic,claude,copilot,gemini] [--overwrite] [--provision-tracker]

agentstack setup rules [--target <repo>]
```

Bare `agentstack setup` is invalid. Always name the module:

```sh
agentstack setup protocol ...
```

Important flags:

| Flag | Description |
| --- | --- |
| `--tracker github\|azure-devops` | Tracker profile to install for the protocol module. |
| `--github-repository OWNER/REPO` | GitHub repository slug. Required for GitHub unless setup can infer it from `origin`. |
| `--azdo-organization <url>` | Azure DevOps organization URL. |
| `--azdo-project <project>` | Azure DevOps project name. |
| `--azdo-team <team>` | Optional Azure Boards team context. |
| `--target <repo>` | Repository directory to initialize. Defaults to current directory. |
| `--agents <list>` | Comma-separated agent shim targets. `generic` is always included. |
| `--overwrite` | Replace existing module-owned installed files. |
| `--provision-tracker` | Create or verify tracker-side configuration where supported. |

For the `protocol` module, setup installs:

- `.agent-stack/modules/protocol/`
- `.agent-stack/modules.json`
- `.agent-stack/.gitignore`
- `.agents/skills/agentstack-protocol-*`
- `.agents/skills/git-worktree-ops`
- an AgentStack-managed block in `AGENTS.md`

Setup copies from package source assets under `assets/`, not from installed target paths. This allows AgentStack to install the protocol module into the AgentStack source repository itself.

For the `rules` module, setup:

- inject its contents into a dedicated managed block at the absolute top of root `AGENTS.md`;
- preserve all content outside the rules managed block;
- update the `rules` entry in `.agent-stack/modules.json`.

### `agentstack uninstall <module>`

Uninstalls a built-in module from a repository.

```sh
agentstack uninstall protocol [--target <repo>] [--purge-runtime]
agentstack uninstall rules [--target <repo>]
```

Default protocol uninstall removes:

- `.agent-stack/modules/protocol/`
- `.agents/skills/agentstack-protocol-*`
- the protocol entry in `.agent-stack/modules.json`
- the protocol managed block in `AGENTS.md`

Default uninstall preserves:

- `.agent-stack/local/`
- `.agent-stack/runs/`
- unrelated `AGENTS.md` content
- shared skills such as `git-worktree-ops`

Use `--purge-runtime` only when local identity and run logs can be removed.

Rules uninstall will remove the `rules` manifest entry and only the rules managed block from `AGENTS.md`.

### `agentstack module list`

Lists installed modules from `.agent-stack/modules.json`.

```sh
agentstack module list [--repo <repo>]
```

Output shape:

```json
{
  "modules": [
    {
      "id": "protocol",
      "installedAt": "2026-05-11T00:00:00.000Z",
      "version": "0.1.1",
      "activeTracker": "github"
    }
  ]
}
```

### `agentstack module status <module>`

Reports whether one module is installed.

```sh
agentstack module status protocol [--repo <repo>]
```

Output shape:

```json
{
  "module": "protocol",
  "installed": true,
  "record": {
    "installedAt": "2026-05-11T00:00:00.000Z",
    "version": "0.1.1",
    "activeTracker": "github"
  }
}
```

## Protocol Commands

These commands are active after:

```sh
agentstack setup protocol ...
```

All non-setup command output is JSON. See [Protocol Commands](modules/protocol/commands.md) for full command detail.

| Command | Purpose |
| --- | --- |
| `agentstack doctor` | Validate installed protocol assets, active tracker config, language, and mapping. |
| `agentstack language validate` | Validate the protocol backlog language asset. |
| `agentstack mapping validate` | Validate the active tracker mapping. |
| `agentstack agent identity init/show` | Create or inspect local agent identity. |
| `agentstack work-item get` | Read one tracker item as canonical protocol data. |
| `agentstack work-item intake` | List items that appear ready for autonomous execution. |
| `agentstack work-item graph` | Read dependency and hierarchy status plus `canStart`. |
| `agentstack work-item claim` | Register an exclusive autonomous execution claim. |
| `agentstack work-item release` | Release an active claim marker. |
| `agentstack work-item state` | Set canonical protocol state. |
| `agentstack work-item progress` | Write a protocol progress comment and local event. |
| `agentstack work-item block` | Mark work blocked and record the blocker. |
| `agentstack work-item plan` | Publish an execution plan and move to implementation. |
| `agentstack work-item submit-review` | Link reviewable work and set state `pr-open`. |
| `agentstack work-item create-child` | Create and link a child tracker item. |
