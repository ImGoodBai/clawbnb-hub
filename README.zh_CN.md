# WeClawBot-ex

[English](./README.md)

这是一个基于 OpenClaw 的微信 demo 插件 fork，用来做多账号扫码接入和本地网页管理。

这个仓库不是独立机器人程序，而是一个 OpenClaw 插件源码仓库。

## 功能范围

- 替代默认的 `openclaw-weixin` 插件
- 增加本地 H5 控制台，用于二维码登录和账号状态查看
- 在一个 OpenClaw Gateway 里挂多个微信账号
- 在页面里显示 `errcode = -14` 冷却状态
- 通过 `session.dmScope = "per-account-channel-peer"` 做微信私聊会话隔离

## 前提条件

- Node.js >= 22
- 已安装 OpenClaw，并且本机可使用 `openclaw` CLI
- 本地有可运行的 OpenClaw Gateway 环境

## 从本仓库安装

当前推荐直接从 GitHub 仓库 checkout 后安装：

```bash
git clone git@github.com:ImGoodBai/WeClawBot-ex.git
cd WeClawBot-ex

openclaw plugins install .
```

也可以直接安装某个本地路径：

```bash
openclaw plugins install /绝对路径/WeClawBot-ex
```

## 最小 OpenClaw 配置

请在 OpenClaw 配置里加入或合并以下内容：

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

## 启动流程

1. 启动 OpenClaw Gateway。
2. 打开 `http://127.0.0.1:19120/`。
3. 点击 `+ 添加微信`。
4. 用微信扫码并在手机上确认。
5. 扫码成功后手动执行一次 `openclaw gateway restart`。
6. 让该微信先发第一句话，用于建立 `context_token`。

## 用户环境注意事项

- 这个页面默认只监听本机：`http://127.0.0.1:19120/`
- 当前 MVP 仍然要求扫码成功后手动重启 Gateway
- `-14` 表示当前微信 bot session 进入冷却，页面会显示该状态
- 同一个真实微信反复重新扫码时，可能产生多条历史 session 记录

## 控制台接口

- `GET /`
- `GET /api/health`
- `POST /api/qr/create`
- `GET /api/qr/:sessionKey/status`
- `GET /api/accounts`
- `POST /api/accounts/:accountId/relogin`
- `GET /api/errors`
- `POST /api/gateway/restart`

## 当前限制

- 这是一个 fork 版插件，不是建立在上游 npm 包上的附加层
- 当前公开仓库还没有合入 Codex / Claude Code 等其它后端集成
- Gateway 重启仍然是手动流程
- 当前不包含 `moltApp` 计费、订单、结算相关能力
