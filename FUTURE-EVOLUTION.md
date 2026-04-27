# AgentStack Future Evolution

This document tracks protocol and CLI ideas that are not part of the active runtime contract yet.

## Policy Enforcement

Possible future policy fields:

- `allowAgentDecomposition`: govern whether agents may create child work items.
- `allowAgentAutoStartChildren`: govern whether agents may immediately claim child items they create.
- `allowAgentToCloseItems`: govern whether agents may move work items to terminal states without human action.
- `claimTtlMinutes`: define how long an active claim remains valid before it can be considered stale.
- `heartbeatIntervalMinutes`: define expected progress heartbeat frequency during long-running work.
- `allowStaleClaimRecovery`: govern whether agents may recover stale claims without human intervention.

These fields should be added to `AGENT-POLICY.json` only when the CLI enforces them or exposes them in command output.
