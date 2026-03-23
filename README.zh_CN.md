# WeClawBot-ex

[English](./README.md)

**微信 ClawBot 多账号扩展** — 让微信 ClawBot 同时支持多个微信扫码登录、同时对话。

微信 ClawBot 官方版一次只能一个微信扫码使用。WeClawBot-ex 解除了这个限制，并提供本地 Web 管理界面，统一管理所有接入的微信账号。

## 相比官方 ClawBot 增加了什么

| | 官方 ClawBot | WeClawBot-ex |
|---|---|---|
| 同时在线账号数 | 1 个 | 不限 |
| 二维码管理 | 仅命令行 | 本地 Web 管理界面 |
| 渠道状态总览 | 无 | 数据面板 + 状态卡片 |
| 冷却诊断 | 无 | `-14` 错误码实时显示 |
| 会话隔离 | 共享 | 按账号+用户独立隔离 |

## 快速开始

### 前置条件

- Node.js >= 22
- 已安装 [OpenClaw](https://docs.openclaw.ai/install)（`openclaw` 命令可用）

### 安装

```bash
git clone https://github.com/ImGoodBai/WeClawBot-ex.git
cd WeClawBot-ex
openclaw plugins install .
```

### 命名说明

当前版本为了兼容运行时，仍然保留下面这几套标识：

- 产品名 / 仓库名：`WeClawBot-ex`
- 插件包名 + 插件配置键：`molthuman-oc-plugin-wx`
- 渠道配置键：`channels.openclaw-weixin`

所以日志里如果同时出现这几个名字，不代表装错仓库，这是当前版本的兼容口径。

### 配置

在 OpenClaw 配置中添加（`openclaw config edit`）：

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
        "port": 19120
      }
    }
  }
}
```

### 使用

1. 启动 OpenClaw Gateway
2. 打开 **http://127.0.0.1:19120/**
3. 点击 **添加微信渠道** — 用微信扫码并在手机上确认
4. 扫码成功后重启 Gateway
5. 用该微信发一条消息 — AI 智能体自动回复

每添加一个微信号，重复第 3 步即可。

## 排障

- `WARNING: Plugin "... contains dangerous code patterns"` 当前在 OpenClaw 里只是告警，不会因为这条扫描提示直接拦截安装。
- 如果看到 `npm install failed`，必须拿到完整 npm stderr 才能确认根因。
- 先检查 `node -v`。当前插件要求 Node.js `>= 22`。
- 再检查 `openclaw --version`。过旧的 OpenClaw 版本可能和当前插件不兼容。
- 如果插件安装成功但管理端没起来，先确认 `channels.openclaw-weixin.demoService.enabled=true`，然后重启 Gateway。

## 工作原理

```
微信用户 A ──┐
微信用户 B ──┤──> WeClawBot-ex（多账号插件）
微信用户 C ──┘         |
                       |──> OpenClaw 智能体
                       |         |
                       └──< 回复各自的微信用户
```

- 基于官方 `@tencent-weixin/openclaw-weixin` 插件 (v1.0.2) 的 fork
- 扩展了 QR 登录模块，支持多会话并发管理
- 新增本地 Web 管理界面（`src/service/`）
- 每个微信账号独立会话隔离，互不干扰

## 维护边界

- 上游协议层和运行层视为冻结
- 后续只继续迭代我们自己的部分：`src/service/`、插件包装层、安装文档
- 除非遇到兼容性阻塞，否则不再修改上游派生文件

## 路线图

- [ ] 群聊 @bot 模式
- [ ] 媒体消息支持（图片、文件、语音）
- [ ] 扫码后热加载（无需重启 Gateway）
- [ ] 对外分享二维码

## 许可证

MIT — 详见 [LICENSE](./LICENSE) 和 [NOTICE](./NOTICE) 中的上游声明。

## 微信交流群

扫码加入微信 ClawBot 交流群：

<img src="./docs/weclawbot-ex-wechat-group-qr.jpg" alt="WeClawBot-ex 微信交流群二维码" width="360" />
