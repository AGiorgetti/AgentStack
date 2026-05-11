# Protocol Commands

Protocol commands are active after:

```sh
agentstack setup protocol ...
```

All non-setup output is JSON.

## Validation

```sh
agentstack doctor [--repo <repo>]
agentstack language validate [--repo <repo>]
agentstack mapping validate [--repo <repo>]
```

## Agent Identity

```sh
agentstack agent identity init [--agent <agent-id>] [--provider <name>] [--repo <repo>]
agentstack agent identity show [--repo <repo>]
```

Identity is stored in `.agent-stack/local/agent-identity.json`.

## Work Items

```sh
agentstack work-item get <id> [--repo <repo>]
agentstack work-item intake [--limit 10] [--agent <agent-id>] [--repo <repo>]
agentstack work-item graph <id> [--repo <repo>]
agentstack work-item claim <id> [--agent <agent-id>] [--branch <name>] [--workspace <path>] [--force] [--repo <repo>]
agentstack work-item release <id> [--claim-token <token>] [--repo <repo>]
agentstack work-item state <id> --state <state> [--repo <repo>]
agentstack work-item progress <id> --message <text> [--repo <repo>]
agentstack work-item block <id> --reason <text> [--repo <repo>]
agentstack work-item plan <id> --message <text> [--repo <repo>]
agentstack work-item submit-review <id> --pr <url> [--summary <text>|--summary-file <path>] [--repo <repo>]
agentstack work-item create-child <parent-id> --title <title> [--kind task] [--description <text>] [--execution-mode agent|human] [--ready-for-agent true|false] [--state <state>] [--repo <repo>]
```
