# Protocol Command Reference

The protocol module activates tracker-backed autonomous work commands after:

```sh
agentstack setup protocol ...
```

Most commands read the active tracker from `.agent-stack/modules/protocol/active-tracker.json`. Use `--repo <path>` when running from outside the target repository. All protocol command output is JSON.

## `agentstack doctor`

Validates repository-local protocol setup.

```sh
agentstack doctor [--repo <repo>]
```

`doctor` verifies:

- `.agent-stack` exists;
- `.agent-stack/modules/protocol` exists;
- `AGENTS.md` exists;
- `.agents/skills` exists;
- the protocol language file validates;
- the active tracker mapping validates;
- installed module metadata is readable.

Output includes `ok`, `repoRoot`, `modules`, `activeTracker`, `files`, `language`, and `mapping`.

## `agentstack language validate`

Validates `.agent-stack/modules/protocol/language/backlog-language.yaml`.

```sh
agentstack language validate [--repo <repo>]
```

Use this when editing the canonical backlog vocabulary. The validator checks required canonical concepts such as protocol states, work item types, readiness fields, execution modes, relations, and acceptance criteria vocabulary.

## `agentstack mapping validate`

Validates the active tracker mapping file.

```sh
agentstack mapping validate [--repo <repo>]
```

Use this when editing `.agent-stack/modules/protocol/trackers/<tracker>.mapping.yaml`. The validator checks that tracker-native labels, tags, fields, states, relations, and readiness mappings can be normalized into the canonical protocol model.

## `agentstack agent identity`

Creates or displays the local agent identity used as the default claim identity.

```sh
agentstack agent identity init [--agent <agent-id>] [--provider <name>] [--repo <repo>]
agentstack agent identity show [--repo <repo>]
```

The identity is stored in `.agent-stack/local/agent-identity.json` and should not be committed.

For concurrent work, initialize identity inside the dedicated worktree that will own the claim. If `--agent` is omitted during `claim`, the CLI uses this local identity or creates one automatically.

## `agentstack work-item get`

Reads one backlog item through the active tracker and returns a canonical `WorkItem`.

```sh
agentstack work-item get <id> [--repo <repo>]
```

Use this instead of `gh issue view` or `az boards work-item show` when an agent needs normalized fields such as:

- `executionMode`
- `readyForAgent`
- `protocolState`
- `claim`
- `acceptanceCriteria`
- `tags`
- `relations`

## `agentstack work-item intake`

Lists work items that appear ready for autonomous agent intake.

```sh
agentstack work-item intake [--limit 10] [--agent <agent-id>] [--repo <repo>]
```

For GitHub, this searches for open issues with configured agent-execution, ready-for-agent, and ready-state labels. For Azure DevOps, it uses the configured tags or fields. `--agent` narrows results to items assigned to a specific agent identifier.

`intake` is a discovery command. It does not claim work and does not guarantee a work item is safe to start; run `work-item graph <id>` before claiming.

## `agentstack work-item graph`

Reads one work item plus dependency and hierarchy status.

```sh
agentstack work-item graph <id> [--repo <repo>]
```

Output includes:

- `root`
- `parent`
- `children`
- `blockedBy`
- `blocks`
- `dependencyStatus`
- `canStart`
- `reasons`

`graph` is the authoritative readiness gate before autonomous execution. Policy can add reasons such as `missing-acceptance-criteria`. Existing claims, non-ready protocol state, human-only execution, or open blockers also make `canStart` false.

## `agentstack work-item claim`

Registers an autonomous execution claim on a work item.

```sh
agentstack work-item claim <id> [--agent <agent-id>] [--branch <name>] [--workspace <path>] [--force] [--repo <repo>]
```

The command:

- reads the work item;
- reads dependency status;
- checks eligibility;
- writes protocol state `claimed`;
- adds the active claim marker;
- records claim metadata as a tracker comment;
- saves the claim token under `.agent-stack/runs/<id>/claim.json`;
- appends a local runtime event.

If `--agent` is omitted, the CLI uses or creates `.agent-stack/local/agent-identity.json`.

`--force` bypasses eligibility failures. Use it only for controlled smoke tests or explicit human-approved exceptions.

## `agentstack work-item release`

Releases an active claim marker from a work item.

```sh
agentstack work-item release <id> [--claim-token <token>] [--repo <repo>]
```

Use this when an agent abandons or hands back work. If `--claim-token` is omitted, the CLI reads `.agent-stack/runs/<id>/claim.json`. Release verifies the token before removing the active claim marker.

## `agentstack work-item state`

Sets a work item's canonical protocol state.

```sh
agentstack work-item state <id> --state <state> [--repo <repo>]
```

Supported states are defined by the protocol implementation and mapping, including:

- `draft`
- `ready`
- `claimed`
- `implementing`
- `blocked`
- `pr-open`
- `in-review`
- `done`
- `abandoned`

`state` only updates the AgentStack protocol state through the active tracker mapping. It does not merge a pull request, close a GitHub issue, move an Azure Boards workflow state, or clear an active claim marker.

## `agentstack work-item progress`

Adds a protocol-formatted progress update comment and appends a local runtime event.

```sh
agentstack work-item progress <id> --message <text> [--repo <repo>]
agentstack work-item progress <id> --message-file <path> [--repo <repo>]
```

`work-item heartbeat` is accepted as a compatibility alias, but new docs and scripts should use `work-item progress`.

## `agentstack work-item block`

Marks work as blocked and records the blocker reason.

```sh
agentstack work-item block <id> --reason <text> [--repo <repo>]
agentstack work-item block <id> --reason-file <path> [--repo <repo>]
```

Use this when progress requires a human decision, missing dependency, unavailable credential, unclear requirement, unsafe repository state, or external failure. The command sets protocol state `blocked`, adds a blocker comment, and records a local blocker event with `needsHumanDecision: true`.

## `agentstack work-item plan`

Publishes an execution plan and moves the item to implementation.

```sh
agentstack work-item plan <id> --message <text> [--repo <repo>]
agentstack work-item plan <id> --file <path> [--repo <repo>]
```

Use this after graph, workspace bootstrap, identity initialization, and claim, before code changes. The command writes a protocol-formatted execution plan comment, sets state `implementing`, and records a local execution-plan event.

## `agentstack work-item submit-review`

Submits completed agent work for pull-request review.

```sh
agentstack work-item submit-review <id> --pr <url> [--summary <text>|--summary-file <path>] [--repo <repo>]
```

The command:

- links the PR or review URL;
- writes a review submission report;
- sets protocol state `pr-open`;
- records a local submit-review event;
- returns `reviewRequired` from repository policy.

It does not merge the pull request or complete the tracker item. Human review remains the default completion boundary.

## `agentstack work-item create-child`

Creates a child work item under an existing parent.

```sh
agentstack work-item create-child <parent-id> --title <title> [--kind task] [--description <text>] [--execution-mode agent|human] [--ready-for-agent true|false] [--state <state>] [--repo <repo>]
```

Use this when work needs to be decomposed into a smaller task, bug, story, or spike. The command creates the tracker item, applies supported protocol metadata, and links it to the parent through the active tracker adapter.
