# Command Reference

This top-level reference describes global AgentStack commands. Module commands are documented with each module. The live source of truth is the CLI help:

```sh
agentstack help
agentstack help setup --json
agentstack help work-item claim --json
```

## `agentstack setup <module>`

Installs a built-in module into a repository.

```sh
agentstack setup protocol --tracker github --github-repository OWNER/REPO [--target <repo>] [--agents generic,claude,copilot,gemini] [--overwrite] [--provision-tracker]

agentstack setup protocol --tracker azure-devops --azdo-organization <url> --azdo-project <project> [--azdo-team <team>] [--target <repo>] [--agents generic,claude,copilot,gemini] [--overwrite] [--provision-tracker]
```

Bare `agentstack setup` is invalid; specify a module.

## `agentstack uninstall <module>`

Uninstalls a built-in module from a repository.

```sh
agentstack uninstall protocol [--target <repo>] [--purge-runtime]
```

Default uninstall removes module-owned assets and preserves shared runtime.

## `agentstack module list`

Lists installed modules.

```sh
agentstack module list [--repo <repo>]
```

## `agentstack module status <module>`

Shows install status for one module.

```sh
agentstack module status protocol [--repo <repo>]
```

## Module Commands

The `protocol` module activates the existing tracker-backed workflow commands:

- `agentstack doctor`
- `agentstack language validate`
- `agentstack mapping validate`
- `agentstack agent identity ...`
- `agentstack work-item ...`

See [Protocol Commands](modules/protocol/commands.md).
