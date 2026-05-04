# Command Reference

This reference describes the current public command surface. The live source of truth is the CLI itself:

```sh
agentstack help
agentstack help work-item claim
agentstack help work-item claim --json
```

Most commands read the active tracker from `.agent-stack/active-tracker.json` in the repository. Use `--repo <path>` when running from outside that repository. All non-setup command output is JSON.

## `agentstack setup`

Installs AgentStack Protocol assets into a product repository.

```sh
agentstack setup --tracker github --github-repository OWNER/REPO [--target <repo>] [--agents generic,claude,copilot,gemini] [--overwrite] [--provision-tracker]

agentstack setup --tracker azure-devops --azdo-organization <url> --azdo-project <project> [--azdo-team <team>] [--target <repo>] [--agents generic,claude,copilot,gemini] [--overwrite] [--provision-tracker]
```

Important flags:

| Flag | Description |
| --- | --- |
| `--tracker github\|azure-devops` | Tracker profile to install. |
| `--github-repository OWNER/REPO` | GitHub repository slug. Required unless inferred from `origin`. |
| `--azdo-organization <url>` | Azure DevOps organization URL. |
| `--azdo-project <project>` | Azure DevOps project name. |
| `--azdo-team <team>` | Optional Azure Boards team context. |
| `--target <repo>` | Repository directory to initialize. Defaults to current directory. |
| `--agents <list>` | Comma-separated agent shim targets. |
| `--overwrite` | Replace existing managed protocol files when present. |
| `--provision-tracker` | Create or verify tracker-side configuration where supported. |

Setup creates or refreshes `.agent-stack`, `.agents/skills/agentstack-*`, `.agents/skills/git-worktree-ops`, and the managed AgentStack block in `AGENTS.md`.

## `agentstack doctor`

Validates repository-local AgentStack setup.

```sh
agentstack doctor [--repo <repo>]
```

Output includes `ok`, `activeTracker`, file presence checks, language validation, and mapping validation.

## `agentstack language validate`

Validates `.agent-stack/language/backlog-language.yaml`.

```sh
agentstack language validate [--repo <repo>]
```

Use this when editing the canonical backlog vocabulary.

## `agentstack mapping validate`

Validates the active tracker mapping file.

```sh
agentstack mapping validate [--repo <repo>]
```

Use this when editing `.agent-stack/trackers/<tracker>.mapping.yaml`.

## `agentstack agent identity`

Creates or displays the local agent identity used as the default claim identity.

```sh
agentstack agent identity init [--agent <agent-id>] [--provider <name>] [--repo <repo>]
agentstack agent identity show [--repo <repo>]
```

The identity is stored in `.agent-stack/local/agent-identity.json` and should not be committed. For concurrent work, initialize identity inside the dedicated worktree that will own the claim.

## `agentstack work-item get`

Reads one backlog item through the active tracker and returns a canonical `WorkItem`.

```sh
agentstack work-item get <id> [--repo <repo>]
```

Use this instead of `gh issue view` or `az boards work-item show` when an agent needs normalized fields such as `executionMode`, `readyForAgent`, `protocolState`, `claim`, `tags`, and `relations`.

## `agentstack work-item intake`

Lists work items that appear ready for autonomous agent intake.

```sh
agentstack work-item intake [--limit 10] [--agent <agent-id>] [--repo <repo>]
```

For GitHub, this searches for open issues with the configured agent-execution, ready-for-agent, and ready-state labels. `--agent` narrows results to items assigned to a specific agent label.

## `agentstack work-item graph`

Reads one work item plus dependency and hierarchy status.

```sh
agentstack work-item graph <id> [--repo <repo>]
```

Output includes parent, children, blockers, blocked items, dependency status, and a `canStart` decision. Policy can add reasons such as `missing-acceptance-criteria`.

## `agentstack work-item claim`

Registers an autonomous execution claim on a work item.

```sh
agentstack work-item claim <id> [--agent <agent-id>] [--branch <name>] [--workspace <path>] [--force] [--repo <repo>]
```

The command checks eligibility, writes protocol state `claimed`, adds the active claim marker, and records claim metadata as a tracker comment. If `--agent` is omitted, the CLI uses or creates the local agent identity.

`--force` bypasses eligibility failures for controlled smoke tests or explicit human-approved exceptions. The generated claim token is saved under `.agent-stack/runs/<id>/claim.json`.

## `agentstack work-item release`

Releases an active claim marker from a work item.

```sh
agentstack work-item release <id> [--claim-token <token>] [--repo <repo>]
```

Use this when an agent abandons or hands back work without completing it. If `--claim-token` is omitted, the CLI reads `.agent-stack/runs/<id>/claim.json`.

## `agentstack work-item state`

Sets a work item's protocol state.

```sh
agentstack work-item state <id> --state <state> [--repo <repo>]
```

Supported canonical states are defined by the repository language and implementation, including `draft`, `ready`, `claimed`, `implementing`, `blocked`, `pr-open`, `in-review`, `done`, and `abandoned`.

Common post-review uses:

```sh
agentstack work-item state <id> --state implementing
agentstack work-item state <id> --state done
```

`state` only updates the AgentStack protocol state through the active tracker mapping. It does not merge a pull request, close a GitHub issue, move an Azure Boards workflow state, or clear the active claim marker.

## `agentstack work-item progress`

Adds a progress update comment.

```sh
agentstack work-item progress <id> --message <text> [--repo <repo>]
agentstack work-item progress <id> --message-file <path> [--repo <repo>]
```

The command records a protocol-formatted tracker comment and appends a local runtime event under `.agent-stack/runs/<id>/`.

`work-item heartbeat` is accepted as a compatibility alias, but new docs and scripts should use `work-item progress`.

## `agentstack work-item block`

Marks work as blocked and records the blocker reason.

```sh
agentstack work-item block <id> --reason <text> [--repo <repo>]
agentstack work-item block <id> --reason-file <path> [--repo <repo>]
```

Use this when progress requires a human decision, missing dependency, unavailable credential, unclear requirement, or external failure.

## `agentstack work-item plan`

Publishes an execution plan and moves the item to implementation.

```sh
agentstack work-item plan <id> --message <text> [--repo <repo>]
agentstack work-item plan <id> --file <path> [--repo <repo>]
```

Use this after graph, workspace bootstrap, identity initialization, and claim, before code changes.

## `agentstack work-item submit-review`

Submits completed agent work for pull-request review.

```sh
agentstack work-item submit-review <id> --pr <url> [--summary <text>|--summary-file <path>] [--repo <repo>]
```

The command links the PR URL, writes a review submission report, sets protocol state `pr-open`, and reports `reviewRequired` from repository policy.

After review, use tracker-native PR tooling for merge decisions. Use `work-item state --state done` after completion, or `work-item state --state implementing` plus `progress` when the human requests changes.

## `agentstack work-item create-child`

Creates a child work item under an existing parent.

```sh
agentstack work-item create-child <parent-id> --title <title> [--kind task] [--description <text>] [--execution-mode agent|human] [--ready-for-agent true|false] [--state <state>] [--repo <repo>]
```

Use this when work needs to be decomposed into a smaller task, bug, story, or spike. The command creates the tracker item, applies supported protocol metadata, and links it to the parent through the active tracker.
