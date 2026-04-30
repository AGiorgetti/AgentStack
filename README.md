# AgentStack CLI

`@agentstack/cli` provides the `agentstack` command-line tool for AgentStack Protocol.

AgentStack Protocol is a repository-local collaboration protocol for AI coding agents and humans working from backlog items such as epics, stories, issues, bugs, and tasks. The CLI gives agents a canonical view over the active issue tracker so they do not have to parse GitHub labels or Azure DevOps fields directly.

## Install

```sh
npm install -g @agentstack/cli
```

## Setup a repository

Most projects use exactly one backlog tracker. Setup deploys only the active tracker profile.

### GitHub

```sh
agentstack setup \
  --target /path/to/product-repo \
  --tracker github \
  --github-repository OWNER/REPO \
  --agents generic \
  --provision-tracker \
  --overwrite
```

`--github-repository` is required unless setup can infer the GitHub repository from the target repo's `origin` remote.

`--provision-tracker` creates or updates the GitHub labels used by the default AgentStack mapping, including execution mode, readiness, type, state, claim, and priority labels.

### Azure DevOps

```sh
agentstack setup \
  --target /path/to/product-repo \
  --tracker azure-devops \
  --azdo-organization https://dev.azure.com/ORG \
  --azdo-project PROJECT \
  --agents generic \
  --provision-tracker \
  --overwrite
```

Azure DevOps setup requires `--azdo-organization` and `--azdo-project`.

The default Azure DevOps profile uses tags and built-in relation types, so there are no labels or custom fields to pre-create. `--provision-tracker` verifies the Azure DevOps CLI path and checks that the configured organization/project is accessible.

If provisioning fails, verify the same Azure DevOps project access directly:

```sh
az extension add --name azure-devops
az devops project show --organization https://dev.azure.com/ORG --project PROJECT --output json
```

## Repository footprint

Setup creates or updates:

```text
AGENTS.md
.agent-stack/
  active-tracker.json
  .gitignore
  PROMPTS.md
  protocol/AGENT-PROTOCOL.md
  language/backlog-language.yaml
  policy/AGENT-POLICY.json
  trackers/<active-tracker>.mapping.yaml
  trackers/<active-tracker>.config.json
.agents/
  skills/agentstack-*/SKILL.md
  skills/git-worktree-ops/SKILL.md
```

Inactive tracker files are not deployed.

If `AGENTS.md` already exists, setup preserves it and inserts or updates only the managed block between:

```md
<!-- agentstack-protocol:start -->
<!-- agentstack-protocol:end -->
```

## Execution Policy

`.agent-stack/policy/AGENT-POLICY.json` contains repository-local workflow gates for autonomous agents. The CLI loads this file for tracker-backed commands and merges it over built-in recommended defaults, so omitted fields fall back to the recommended value.

Default policy:

```json
{
  "requireHumanReviewBeforeMerge": true,
  "requireAcceptanceCriteria": true
}
```

Current policy fields:

| Field | Default | CLI effect |
| --- | --- | --- |
| `requireAcceptanceCriteria` | `true` | Used by `work-item graph` and `work-item claim` when calculating whether a work item can start. If true, a work item without parsed acceptance criteria is reported with `missing-acceptance-criteria`; `work-item claim` refuses the claim unless `--force` is used. |
| `requireHumanReviewBeforeMerge` | `true` | Used by `work-item submit-review`. The command always sets protocol state `pr-open`, and its JSON output includes `reviewRequired` with this policy value so agents and humans know whether merge must remain human-controlled. |

Policy does not replace tracker state. A work item still needs the active tracker mapping to resolve `executionMode`, `readyForAgent`, `protocolState`, claims, and dependency relations. Policy is applied after those tracker values are normalized into AgentStack's canonical work item model.

Example `work-item graph` output when policy blocks automatic start:

```json
{
  "canStart": false,
  "reasons": [
    "missing-acceptance-criteria"
  ]
}
```

Use `--force` on `work-item claim` only for controlled smoke tests or explicit human-approved exceptions:

```sh
agentstack work-item claim 123 --agent codex-smoke --force
```

Acceptance criteria are parsed from tracker descriptions. Supported formats include an `Acceptance Criteria:` inline section separated by semicolons, or an `Acceptance Criteria` / `Definition of Done` Markdown or HTML section with bullets, checkboxes, numbered items, or plain lines.

## Agent usage

Agents should use the CLI instead of calling tracker-native commands directly for normal protocol work:

```sh
agentstack doctor
agentstack work-item get 123
agentstack work-item graph 123
# create or enter an isolated workspace/worktree for item 123
agentstack agent identity init
agentstack work-item claim 123 --branch agentstack/123 --workspace ../<repo>-worktrees/123
agentstack work-item progress 123 --message "Implementation started."
agentstack work-item submit-review 123 --pr https://github.com/OWNER/REPO/pull/456
```

All non-setup command output is JSON.

Reusable human prompt templates for starting intake, assigning a specific item, blocking, resuming after resolution, or submitting review live in `.agent-stack/PROMPTS.md`. Agents do not need that file during execution; they should use `AGENTS.md`, protocol assets, skills, and `agentstack help ... --json`.

## Agent identity

Claims need an agent identity. You can provide one explicitly:

```sh
agentstack work-item claim 123 --agent codex/aless-laptop
```

Or let the CLI create a local identity:

```sh
agentstack agent identity init
agentstack agent identity show
agentstack work-item claim 123
```

The local identity is stored in `.agent-stack/local/agent-identity.json` and should not be committed. It gives a stable default `agentId` across sessions in the same repo/workspace. For concurrent agent work, initialize identity inside the dedicated worktree that will own the claim.

`claimToken` is different from `agentId`: `agentId` says who owns the claim, while `claimToken` proves ownership of that specific claim. Successful claims save the token locally under `.agent-stack/runs/<id>/claim.json`, so later commands can use it by default:

```sh
agentstack work-item release 123
```

Use `--agent` and `--claim-token` when running from CI or from a workspace that does not have local identity/claim state.

## Concurrent agents

When multiple agents may work at the same time, each work item should use a dedicated git worktree or equivalent isolated workspace. The main checkout should be used for setup, fetch, intake, and orchestration; implementation should happen in the per-item worktree.

Recommended startup:

```sh
# from the coordination checkout
git fetch origin
agentstack work-item get 123
agentstack work-item graph 123

repo_name=$(basename "$(git rev-parse --show-toplevel)")
worktree_root="../${repo_name}-worktrees"
mkdir -p "$worktree_root"
git config --global --add safe.directory "$(cd "$worktree_root" && pwd -P)/*"
git worktree add "${worktree_root}/123" -b agentstack/123 origin/main
cd "${worktree_root}/123"

agentstack agent identity init
agentstack work-item claim 123 --branch agentstack/123 --workspace "${worktree_root}/123"
agentstack work-item plan 123 --message "..."
```

Claim from inside the worktree that will perform the implementation. This keeps the identity file, claim token, git index, branch, build artifacts, and local runtime state isolated from other agents.

If Git still reports dubious ownership inside a worktree, add the concrete path as a fallback:

```sh
git config --global --add safe.directory "$(pwd -P)"
```

After removing a worktree that used a concrete fallback entry, clean up that exact Git safe-directory value:

```sh
git config --global --fixed-value --unset-all safe.directory "$(cd "$worktree_root" && pwd -P)/123"
```

Keep the repo-scoped wildcard entry while the worktree root is still in use.

## Generated Help

The CLI is the source of truth for command syntax, flags, output shape, examples, and policy effects.

For humans:

```sh
agentstack help
agentstack help work-item claim
agentstack work-item claim --help
```

For agents and tooling:

```sh
agentstack help --json
agentstack help work-item claim --json
agentstack help work-item submit-review --json
```

Skills should reference `agentstack help ... --json` for the live command contract instead of duplicating command manuals that can drift from the implementation.

## Command reference

Most commands read the active tracker from `.agent-stack/active-tracker.json` in the target repository. Use `--repo <path>` when running from outside that repository.

### `agentstack setup`

Installs AgentStack Protocol assets into a product repository. This is the entrypoint for adopting AgentStack in a repository.

```sh
agentstack setup --tracker github --github-repository OWNER/REPO [--target <repo>] [--agents generic,claude,copilot,gemini] [--overwrite] [--provision-tracker]
agentstack setup --tracker azure-devops --azdo-organization <url> --azdo-project <project> [--azdo-team <team>] [--target <repo>] [--agents generic,claude,copilot,gemini] [--overwrite] [--provision-tracker]
```

Use it to create or refresh `.agent-stack`, `.agents/skills/agentstack-*`, `.agents/skills/git-worktree-ops`, and the managed AgentStack block in `AGENTS.md`. It deploys only the selected tracker profile. With `--provision-tracker`, GitHub labels are created or updated; Azure DevOps setup checks the Azure DevOps CLI path and verifies access to the configured project because the default profile uses tags.

### `agentstack doctor`

Validates that a repository is ready for AgentStack workflow execution.

```sh
agentstack doctor [--repo <repo>]
```

Use this before agent work or after setup changes. It checks repository-local protocol files, active tracker configuration, language validation, and tracker mapping validation. Output includes an `ok` boolean plus file and validation details.

### `agentstack agent identity`

Creates or displays the local agent identity used as the default claim identity.

```sh
agentstack agent identity init [--agent <agent-id>] [--provider <name>] [--repo <repo>]
agentstack agent identity show [--repo <repo>]
```

Use this before claim if you want a predictable local `agentId`. If omitted, `work-item claim` creates the identity automatically. The file is local runtime state under `.agent-stack/local/agent-identity.json`. For concurrent work, run this inside the dedicated worktree before claiming.

### `agentstack language validate`

Validates `.agent-stack/language/backlog-language.yaml`.

```sh
agentstack language validate [--repo <repo>]
```

Use this when editing the canonical backlog vocabulary. It catches malformed YAML and missing required language concepts before agents rely on them.

### `agentstack mapping validate`

Validates the active tracker mapping file.

```sh
agentstack mapping validate [--repo <repo>]
```

Use this when editing `.agent-stack/trackers/<tracker>.mapping.yaml`. It checks that tracker-native labels, tags, fields, states, and relation names map back to the canonical AgentStack language.

### `agentstack work-item get`

Reads one backlog item through the active tracker and returns a canonical `WorkItem`.

```sh
agentstack work-item get <id> [--repo <repo>]
```

Use this instead of `gh issue view` or `az boards work-item show` when an agent needs normalized fields such as `executionMode`, `readyForAgent`, `protocolState`, `claim`, `tags`, and `relations`.

### `agentstack work-item intake`

Lists work items that appear ready for autonomous agent intake.

```sh
agentstack work-item intake [--limit 10] [--agent <agent-id>] [--repo <repo>]
```

Use this to discover candidate work. For GitHub, it searches for open issues with the configured agent-execution, ready-for-agent, and ready-state labels. `--agent` narrows the result to items assigned to a specific agent label.

### `agentstack work-item graph`

Reads one work item plus its dependency and hierarchy status.

```sh
agentstack work-item graph <id> [--repo <repo>]
```

Use this before claiming work. It returns parent, children, blockers, blocked items, dependency status, and a `canStart` decision with reasons based on policy gates such as active claims, blocked dependencies, protocol state, and acceptance criteria.

### `agentstack work-item claim`

Registers an autonomous execution claim on a work item.

```sh
agentstack work-item claim <id> [--agent <agent-id>] [--branch <name>] [--workspace <path>] [--force] [--repo <repo>]
```

Use this immediately before planning and implementation starts, from inside the isolated workspace that will do the work. It checks eligibility, writes protocol state `claimed`, adds the active claim marker, and records claim metadata as a tracker comment. If `--agent` is omitted, the CLI uses or creates the local agent identity. `--force` bypasses eligibility failures for controlled smoke tests or human-approved exceptions.

The generated claim token is saved under `.agent-stack/runs/<id>/claim.json` for later release or future resume operations.

### `agentstack work-item release`

Releases an active claim marker from a work item.

```sh
agentstack work-item release <id> [--claim-token <token>] [--repo <repo>]
```

Use this when an agent abandons or hands back work without completing it. It removes the active claim marker and records a release comment. If `--claim-token` is omitted, the CLI reads `.agent-stack/runs/<id>/claim.json`. Historical claim comments remain for audit, but released claims are not reported as active by `work-item get`.

### `agentstack work-item state`

Sets a work item's protocol state.

```sh
agentstack work-item state <id> --state <state> [--repo <repo>]
```

Use this for explicit state transitions such as `ready`, `implementing`, `blocked`, `pr-open`, `in-review`, `done`, or `abandoned`. The command updates the tracker-native representation defined by the active mapping.

### `agentstack work-item progress`

Adds a progress update comment.

```sh
agentstack work-item progress <id> --message <text> [--repo <repo>]
```

Use this during long-running work to keep humans and other agents informed. It records a protocol-formatted tracker comment and appends a local runtime event under `.agent-stack/runs/<id>/`.

`work-item heartbeat` is accepted as a compatibility alias, but new documentation and scripts should use `work-item progress`.

### `agentstack work-item block`

Marks work as blocked and records the blocker reason.

```sh
agentstack work-item block <id> --reason <text> [--repo <repo>]
```

Use this when progress requires a human decision, missing dependency, unavailable credential, unclear requirement, or external failure. It sets protocol state `blocked`, comments with the reason, and records a local blocker event.

### `agentstack work-item plan`

Publishes an execution plan and moves the item to implementation.

```sh
agentstack work-item plan <id> --message <text> [--repo <repo>]
agentstack work-item plan <id> --file <path> [--repo <repo>]
```

Use this after graph, workspace bootstrap, identity initialization, and claim, before code changes. It records the plan as a protocol comment, sets state `implementing`, and appends a local execution-plan event.

### `agentstack work-item submit-review`

Submits completed agent work for pull-request review.

```sh
agentstack work-item submit-review <id> --pr <url> [--summary <text>|--summary-file <path>] [--repo <repo>]
```

Use this after opening a pull request or otherwise producing reviewable work. It links the PR URL in a comment, writes a review submission report, sets protocol state `pr-open`, and reports whether human review is required by policy.

### `agentstack work-item create-child`

Creates a child work item under an existing parent.

```sh
agentstack work-item create-child <parent-id> --title <title> [--kind task] [--description <text>] [--execution-mode agent|human] [--ready-for-agent true|false] [--state <state>] [--repo <repo>]
```

Use this when work needs to be decomposed into a smaller task, bug, story, or spike. The command creates the tracker item, applies supported protocol metadata, and links it to the parent through the active tracker.

## Validation

```sh
agentstack doctor
agentstack language validate
agentstack mapping validate
```

`doctor` validates the repository-local `.agent-stack` structure and rejects tracker configs that still contain placeholders such as `OWNER/REPO`.

## Development

```sh
npm install
npm run build
npm run typecheck
npm test
npm pack --dry-run
```

### Use This Checkout Locally

During development, you can expose this checkout as the global `agentstack` command without publishing or installing from npm:

```sh
npm install
npm run build
npm link
```

Then use it from any test or product repository:

```sh
agentstack --help
agentstack setup --tracker github --github-repository OWNER/REPO --agents generic --overwrite
agentstack doctor --repo .
```

After changing TypeScript source, rebuild this repository:

```sh
npm run build
```

`npm link` points the global command at this checkout, so the linked command runs the current `dist/` output.

To remove the global link:

```sh
npm unlink -g @agentstack/cli
```

You can also run the CLI directly without linking:

```sh
node ./dist/agentstack.js --help
node ./dist/agentstack.js doctor --repo .
```

To test repository setup locally without a live tracker mutation:

```sh
node dist/agentstack.js setup \
  --target ./tmp-agentstack-target \
  --tracker github \
  --github-repository OWNER/REPO \
  --agents generic \
  --overwrite

node dist/agentstack.js doctor --repo ./tmp-agentstack-target
node dist/agentstack.js language validate --repo ./tmp-agentstack-target
node dist/agentstack.js mapping validate --repo ./tmp-agentstack-target
```

### Live GitHub Smoke Test

This flow creates a disposable private repository, installs AgentStack Protocol into it, provisions the required GitHub labels, and exercises the basic protocol commands against one issue.

Replace `OWNER` with your GitHub login or organization.

```sh
gh auth status
gh repo create OWNER/agentstack-smoke --private --clone
cd agentstack-smoke

agentstack setup \
  --tracker github \
  --github-repository OWNER/agentstack-smoke \
  --agents generic \
  --provision-tracker \
  --overwrite

agentstack doctor --repo .
agentstack language validate --repo .
agentstack mapping validate --repo .
agentstack agent identity init --agent codex-smoke --repo .

gh issue create \
  --title "AgentStack smoke test" \
  --body "## Acceptance Criteria
- Smoke claim works
- Smoke progress works
- Smoke submit-review works" \
  --label exec:agent \
  --label ready:agent \
  --label state:ready \
  --label type:task

agentstack work-item get 1 --repo .
agentstack work-item graph 1 --repo .
agentstack work-item claim 1 --repo .
agentstack work-item progress 1 --message "Smoke claim succeeded." --repo .
agentstack work-item plan 1 --message "Smoke-test the AgentStack protocol command flow." --repo .
agentstack work-item submit-review 1 --pr https://github.com/OWNER/agentstack-smoke/pull/1 --summary "Smoke flow completed through submit-review." --repo .
```

The claim should not need `--force` when the item is in `ready` state, has no active claim or open blockers, and includes parseable acceptance criteria.

### Live Azure DevOps Smoke Test

This flow uses a disposable Azure DevOps project or test area, installs AgentStack Protocol into a local checkout, and exercises the basic protocol commands against one Azure Boards work item.

Replace `ORG` and `PROJECT` with your Azure DevOps values. `--azdo-organization` must be the full organization URL.

```sh
az login
az extension add --name azure-devops
az devops project show --organization https://dev.azure.com/ORG --project PROJECT --output json

mkdir agentstack-azdo-smoke
cd agentstack-azdo-smoke
git init

agentstack setup \
  --tracker azure-devops \
  --azdo-organization https://dev.azure.com/ORG \
  --azdo-project PROJECT \
  --agents generic \
  --provision-tracker \
  --overwrite

agentstack doctor --repo .
agentstack language validate --repo .
agentstack mapping validate --repo .
agentstack agent identity init --agent codex-smoke --repo .
```

Add `--azdo-team TEAM` to setup if the project uses a specific Azure Boards team context.

The default Azure DevOps profile stores protocol signals as tags such as `exec:agent`, `ready:agent`, and `state:ready`; Azure DevOps creates tags as work items use them. Create a smoke work item with those tags:

```sh
az boards work-item create \
  --organization https://dev.azure.com/ORG \
  --project PROJECT \
  --type Task \
  --title "AgentStack smoke test" \
  --description "Acceptance Criteria: Smoke claim works; Smoke progress works; Smoke submit-review works" \
  --fields "System.Tags=exec:agent; ready:agent; state:ready; type:task"
```

The Azure CLI prints the created work item JSON. Use its `id` in the following commands:

```sh
agentstack work-item get <id> --repo .
agentstack work-item graph <id> --repo .
agentstack work-item claim <id> --repo .
agentstack work-item progress <id> --message "Smoke claim succeeded." --repo .
agentstack work-item plan <id> --message "Smoke-test the AgentStack protocol command flow." --repo .
agentstack work-item submit-review <id> --pr https://dev.azure.com/ORG/PROJECT/_git/REPO/pullrequest/1 --summary "Smoke flow completed through submit-review." --repo .
```

The claim should not need `--force` when the item is in `ready` state, has no active claim or open blockers, and includes parseable acceptance criteria.
