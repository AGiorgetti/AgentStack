# AgentStack Future Evolution

This document tracks protocol and CLI ideas that are not part of the active runtime contract yet.

## Policy Enforcement

Possible future policy fields:

- `allowAgentDecomposition`: govern whether agents may create child work items.
- `allowAgentAutoStartChildren`: govern whether agents may immediately claim child items they create.
- `allowAgentToCloseItems`: govern whether agents may move work items to terminal states without human action.
- `claimTtlMinutes`: define how long an active claim remains valid before it can be considered stale.
- `progressIntervalMinutes`: define expected progress update frequency during long-running work.
- `allowStaleClaimRecovery`: govern whether agents may recover stale claims without human intervention.

These fields should be added to `AGENT-POLICY.json` only when the CLI enforces them or exposes them in command output.

## Worktree Bootstrap

Concurrent agents need isolated mutable workspaces. Git worktrees are the best default for ordinary git repositories because they isolate the working tree, index, branch, local AgentStack identity, claim token, build outputs, and editor state while sharing the same object database.

The active protocol should require the sequence:

```text
graph -> bootstrap workspace -> identity -> claim -> plan -> implement
```

A future CLI command should automate this sequence instead of expecting every agent to hand-roll git commands:

```sh
agentstack work-item bootstrap <id> [--base origin/main] [--worktrees-dir ../agentstack-worktrees] [--branch <name>]
```

Possible behavior:

- verify `agentstack doctor`
- run `work-item graph` and fail if `canStart` is false
- compute a deterministic branch and worktree path
- run `git fetch`
- create a dedicated `git worktree`
- initialize local identity inside the worktree
- optionally claim from inside the worktree with `--branch` and `--workspace`
- print the workspace path and next command

This probably deserves a dedicated skill, such as `agentstack-worktree-bootstrap`, once the CLI command exists. Keeping it separate from generic `agentstack-work-bootstrap` would let repositories use non-git isolation later without overloading the worktree-specific rules.

Until this exists, skills should describe git worktrees as the recommended manual isolation mechanism for concurrent agents.

## Skill-Specific Markdown Templates

The active protocol has one simple repository-customizable style guide at `.agent-stack/templates/markdown-style.md`. That is enough for now and avoids scattering formatting rules through every skill.

If agents need more structured guidance later, add optional skill-specific templates:

```text
.agent-stack/templates/
  progress.md
  execution-plan.md
  blocker.md
  submit-review.md
  child-work-item.md
```

Skills should reference those files by path instead of duplicating template text. The CLI could later expose them through a command such as:

```sh
agentstack template show submit-review
```

This should remain guidance until the CLI can validate or render templates consistently.

## Partial Handoff

`submit-review` now means completed agent work has been submitted for human review, usually through a pull request. A future `handoff` command should be added with different semantics for partial or interrupted work.

Possible future command:

```sh
agentstack work-item handoff <id> --summary <text> [--branch <name>] [--workspace <path>] [--remaining <text>]
```

Unlike `submit-review`, a true partial handoff should not imply that implementation is complete or that a PR is ready. It should capture enough context for another agent or human to continue safely:

- completed work
- remaining work
- current branch and workspace
- validation status
- known risks and blockers
- whether the active claim should be released, transferred, or kept blocked

The command may need a dedicated protocol state such as `paused`, `handoff`, or `needs-continuation`, but that state should not be added until the CLI and tracker mappings enforce the behavior consistently.

## Resume Blocked Work

The active protocol can mark work as `blocked`, and the current transition table allows `blocked -> ready`. It does not yet define a dedicated way for the same agent to resume a blocked operation while keeping ownership.

The future protocol should distinguish two cases:

### Blocked and abandoned

Use this when the current agent cannot continue and should hand the item back to the backlog.

Target behavior:

```text
blocked -> ready -> claim -> plan -> implement
```

The agent should release its claim, and the resolved item can be claimed by any eligible agent:

```sh
agentstack work-item release <id>
agentstack work-item state <id> --state ready
```

### Blocked but still owned

Use this when the work is paused for a human decision, dependency resolution, or temporary tool failure, but the same agent should continue after the blocker is resolved.

Target behavior:

```text
blocked -> implementing
```

This transition should require the same active claim token and should record why the work is safe to resume.

Possible future command:

```sh
agentstack work-item resume <id> --claim-token <token> --message <text>
```

Expected behavior:

- verify the active claim token belongs to the resuming agent
- verify the blocker has been resolved or explicitly overridden by a human
- move protocol state from `blocked` to `implementing`
- write a resume/progress event to the tracker and local protocol log
- fail non-zero if the claim token does not match, the item is not blocked, or dependencies are still open

Until this exists, agents should prefer the safer abandoned flow: block, release the claim when they cannot continue promptly, return the item to `ready` after resolution, and claim it again before implementation resumes.

## Claim Race Prevention

The current claim flow can still have a race window:

1. Agent A reads a ready work item.
2. Agent B reads the same ready work item before Agent A writes its claim.
3. Both agents decide the item is claimable.
4. Both attempt to write claim state and claim metadata.

A future claim implementation should make claim success token-verified and conflict-aware. A claim should be considered valid only after the agent writes its generated claim token and then re-reads the tracker to verify that the current active claim token is still its own.

Target protocol rule:

> A claim is successful only when the tracker's current active claim token equals the token generated by the claiming agent after the claim write has been verified.

Expected successful response:

```json
{
  "claimed": true,
  "claim": {
    "agentId": "codex-smoke",
    "claimToken": "clm_example",
    "claimedAt": "2026-04-29T12:00:00.000Z"
  }
}
```

Expected conflict response:

```json
{
  "claimed": false,
  "conflict": true,
  "activeClaim": {
    "agentId": "other-agent",
    "claimToken": "clm_other",
    "claimedAt": "2026-04-29T12:00:01.000Z"
  }
}
```

The CLI should exit non-zero on claim conflict so an agent stops instead of starting implementation.

### GitHub

GitHub Issues labels and comments are not transactional. The practical implementation should be:

1. Re-read the issue immediately before claiming.
2. Reject if an active claim marker already exists.
3. Add the active claim marker and claimed protocol state.
4. Add claim metadata with a generated token.
5. Re-read labels and claim metadata.
6. Return success only if the latest active claim token belongs to this agent.
7. If another claim won, report conflict and stop.

Optional supporting labels may make conflicts easier to inspect:

```text
claim:active
claimed-by:<agent-id>
claim-token:<short-token>
```

### Azure DevOps

Azure DevOps work items expose revisions, so the adapter should use optimistic concurrency:

1. Read the work item and revision.
2. Patch claim fields/tags with the expected revision.
3. If the revision changed, fail the claim and re-read.
4. Return success only if the current active claim token matches this agent's token.

This is closer to compare-and-swap and should be preferred where the Azure DevOps API supports it.

### Claim Release

`work-item release` should validate `--claim-token` before removing an active claim. One agent must not be able to release another agent's claim by accident. Release should succeed only when the current active claim token matches the provided token; otherwise it should report a conflict and leave the claim intact.
