# Architecture

## Current Model

Current public releases of WeClawBot-ex support two routing modes:

```text
Default mode:
WeChat User A -> Weixin Account A -> Agent A
WeChat User B -> Weixin Account B -> Agent B
WeChat User C -> Weixin Account C -> Agent C

Fallback mode:
WeChat User X -> main
```

This means:

- one OpenClaw Gateway process
- multiple WeChat channel accounts
- one dedicated OpenClaw agent per stable WeChat user by default
- shared `main` agent only as a fallback path
- DM session isolation through `dmScope=per-account-channel-peer`

## What WeClawBot-ex Adds

Compared with the upstream `@tencent-weixin/openclaw-weixin` plugin, WeClawBot-ex mainly adds:

- a local Web control console
- QR login state polling
- account aggregation and relogin UX
- cooldown visibility for `-14`
- auto-triggered channel reload after QR confirmation
- default userId -> agentId binding with dedicated agent registration
- a minimal automated quality gate

The upstream plugin already contains much of the multi-account runtime skeleton.  
WeClawBot-ex focuses on management, operator workflow, and productization.

## Isolation Boundary Today

### Already isolated

- account credentials are stored per account
- each account runs its own long-poll monitor
- `context_token` is tracked per account / user pair
- DM session keys can be isolated by `accountId + peer`
- dedicated agent routing is enabled per stable WeChat user by default
- agent workspace separates naturally by agent id

### Not fully isolated yet

- shared `main` is still used as a fallback when dedicated binding cannot be completed
- existing early shared-agent test data is not migrated in this release
- tool execution environment is shared
- runtime side effects are shared

So the current release solves **conversation cross-talk** and can route one WeChat account to one agent, but it still does not provide full tenant-level hard isolation.

## Planned Next Stage

The next major architecture step is to harden the dedicated-agent mode:

- workspace bootstrap and lifecycle per agent
- clearer migration path from shared-agent installs
- stronger tenant boundaries
- less risk of shared tool/runtime side effects

## Commercial Direction

WeClawBot-ex is also designed toward future commercial distribution:

- shareable QR entry points
- charging per WeChat entry
- distribution-friendly plugin workflow

That commercial path depends on two foundations:

1. stronger isolation
2. cleaner distribution and billing flows
