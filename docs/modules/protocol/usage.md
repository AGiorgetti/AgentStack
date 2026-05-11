# Protocol Usage

## Setup

GitHub:

```sh
agentstack setup protocol \
  --target /path/to/product-repo \
  --tracker github \
  --github-repository OWNER/REPO \
  --agents generic \
  --provision-tracker \
  --overwrite
```

Azure DevOps:

```sh
agentstack setup protocol \
  --target /path/to/product-repo \
  --tracker azure-devops \
  --azdo-organization https://dev.azure.com/ORG \
  --azdo-project PROJECT \
  --agents generic \
  --provision-tracker \
  --overwrite
```

## Execution Flow

```sh
agentstack doctor
agentstack work-item get 123
agentstack work-item graph 123
agentstack agent identity init
agentstack work-item claim 123 --branch agentstack/123 --workspace ../repo-worktrees/123
agentstack work-item plan 123 --message "Implement the scoped behavior and validate it."
agentstack work-item progress 123 --message "Implementation started."
agentstack work-item submit-review 123 --pr https://github.com/OWNER/REPO/pull/456
```

Use `block` when work cannot continue safely:

```sh
agentstack work-item block 123 --reason "Cannot verify deployment because staging credentials are unavailable."
```

Use `release` when abandoning or handing back a claim:

```sh
agentstack work-item release 123
```

## Validation

```sh
agentstack doctor
agentstack language validate
agentstack mapping validate
```
