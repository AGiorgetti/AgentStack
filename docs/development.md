# Development

## Loop

```sh
npm install
npm run build
npm run typecheck
npm test
npm pack --dry-run
```

Run the built CLI directly:

```sh
node ./dist/agentstack.js help --json
node ./dist/agentstack.js setup protocol --help
```

## Change A Global Command

1. Update command handling in `src/agentstack.ts`.
2. Update structured metadata in `src/help.ts`.
3. Update [Commands](commands.md).
4. Add or update tests.

## Change A Module

1. Update the module docs under `docs/modules/<module>/`.
2. Update setup, uninstall, and status behavior together.
3. Keep deployable assets under `assets/`, not under `.agent-stack` or `.agents`.
4. Update command help and tests.
5. Run build, typecheck, and tests.

## Test Map

| Test file | Coverage |
| --- | --- |
| `tests/acceptance-criteria.test.mjs` | Acceptance criteria parsing. |
| `tests/azure-devops.adapter.test.mjs` | Azure DevOps adapter behavior. |
| `tests/cli.test.mjs` | CLI-level behavior and help. |
| `tests/github.adapter.test.mjs` | GitHub adapter behavior. |
| `tests/markdown.test.mjs` | Markdown formatting helpers. |
| `tests/protocol-assets.test.mjs` | Deployable protocol asset expectations. |
| `tests/protocol.test.mjs` | Protocol eligibility and claim behavior. |
| `tests/setup-agent-stack.test.mjs` | Module setup and uninstall behavior. |
