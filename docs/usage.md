# Usage

AgentStack usage is module-specific. Install the protocol module for tracker-backed autonomous work:

```sh
agentstack setup protocol --tracker github --github-repository OWNER/REPO
```

Then use the activated protocol commands:

```sh
agentstack doctor
agentstack work-item graph 123
agentstack work-item claim 123
```

See [Protocol Usage](modules/protocol/usage.md).
