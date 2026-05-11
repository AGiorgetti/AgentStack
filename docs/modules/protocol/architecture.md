# Protocol Architecture

The protocol module provides the existing AgentStack autonomous workflow.

```mermaid
flowchart TD
  Commands["doctor / language / mapping / agent / work-item"] --> Context["protocol context"]
  Context --> Assets[".agent-stack/modules/protocol"]
  Context --> Policy["policy/AGENT-POLICY.json"]
  Context --> Mapping["trackers/<tracker>.mapping.yaml"]
  Context --> Adapter["TrackerAdapter"]
  Adapter --> GitHub["GitHub via gh"]
  Adapter --> AzDO["Azure DevOps via az"]
  Commands --> Runtime[".agent-stack/runs"]
```

## Source Map

| Path | Role |
| --- | --- |
| `src/agentstack.ts` | Host router plus protocol command handlers. |
| `src/help.ts` | Structured help for global and protocol commands. |
| `src/model.ts` | Canonical work item, relation, claim, platform, and protocol state types. |
| `src/protocol.ts` | Eligibility checks, claim creation, and claim token validation. |
| `src/policy.ts` | Recommended execution policy defaults. |
| `src/tracker.ts` | Tracker adapter interface. |
| `src/github.ts` | GitHub tracker adapter. |
| `src/azure-devops.ts` | Azure DevOps tracker adapter. |
| `src/language/*` | Canonical language, mapping, and validation. |

## Runtime State

The module reads installed assets from `.agent-stack/modules/protocol` and writes shared local runtime under `.agent-stack/local` and `.agent-stack/runs`.

## Tracker Boundary

Protocol commands use the active tracker config and mapping. Agents should use the `agentstack` CLI for normal protocol operations instead of tracker-native CLIs.
