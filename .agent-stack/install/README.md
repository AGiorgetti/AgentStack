# AgentStack Protocol installer

The installer is invoked through the global `agentstack` CLI:

```sh
agentstack setup --tracker github --github-repository OWNER/REPO
```

or directly from this package during development:

```sh
node .agent-stack/install/setup-agent-stack.mjs --tracker github --github-repository OWNER/REPO
```

The installer copies common protocol files, selected tracker mapping/config only, and optional agent discovery shims. It refuses to create tracker configs with unresolved placeholders.
