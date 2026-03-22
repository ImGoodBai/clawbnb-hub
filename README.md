# WeClawBot-ex

OpenClaw Weixin demo plugin fork for multi-account QR login and a local web console.

This repository is not a standalone bot runtime. It is an OpenClaw plugin source repository.

## What It Does

- Replaces the stock `openclaw-weixin` plugin with a forked build
- Adds a local HTTP/H5 control page for QR login and account status
- Supports multiple saved Weixin accounts in one OpenClaw Gateway
- Shows `errcode = -14` cooldown state in the UI
- Keeps DM sessions isolated with `session.dmScope = "per-account-channel-peer"`

## Prerequisites

- Node.js >= 22
- OpenClaw installed and `openclaw` CLI available
- A local OpenClaw Gateway environment

## Install From This Repository

Recommended for users right now:

```bash
git clone git@github.com:ImGoodBai/WeClawBot-ex.git
cd WeClawBot-ex

openclaw plugins install .
```

OpenClaw also supports installing from a local checkout path:

```bash
openclaw plugins install /absolute/path/to/WeClawBot-ex
```

## Minimal OpenClaw Config

Add or merge the following into your OpenClaw config:

```json
{
  "session": {
    "dmScope": "per-account-channel-peer"
  },
  "plugins": {
    "entries": {
      "molthuman-oc-plugin-wx": {
        "enabled": true,
        "package": "molthuman-oc-plugin-wx"
      }
    }
  },
  "channels": {
    "openclaw-weixin": {
      "baseUrl": "https://ilinkai.weixin.qq.com",
      "demoService": {
        "enabled": true,
        "bind": "127.0.0.1",
        "port": 19120,
        "restartCommand": "openclaw gateway restart"
      }
    }
  }
}
```

## Start Flow

1. Start your OpenClaw Gateway.
2. Open `http://127.0.0.1:19120/`.
3. Click `+ Add Weixin`.
4. Scan the QR code in Weixin and confirm on phone.
5. Restart Gateway after scan success.
6. Send the first message from that Weixin account to establish `context_token`.

## User-Facing Notes

- The web console is local-only by default: `http://127.0.0.1:19120/`
- This MVP still requires a manual `openclaw gateway restart` after login
- `-14` means the current Weixin bot session is cooling down; the page shows that state
- One real Weixin account can accumulate multiple historical bot sessions after repeated re-login

## Local Control Page

Endpoints exposed by the demo service:

- `GET /`
- `GET /api/health`
- `POST /api/qr/create`
- `GET /api/qr/:sessionKey/status`
- `GET /api/accounts`
- `POST /api/accounts/:accountId/relogin`
- `GET /api/errors`
- `POST /api/gateway/restart`

## Current Limits

- This repo is a forked plugin, not an addon on top of the upstream package
- The current public repo does not yet include Codex / Claude Code backend integration
- Gateway restart is still manual
- This project does not include `moltApp` billing, order, or settlement integration
