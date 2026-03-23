# WeClawBot-ex

[English](./README.md)

**微信 ClawBot 多账号管理增强层** — 让微信 ClawBot 更适合多微信接入、统一管理和后续对外分发。

WeClawBot-ex 是基于官方 `@tencent-weixin/openclaw-weixin` 的产品化 fork，把官方已有的多账号运行骨架做成了可视化、可管理的微信控制台。

## 当前版本能力

当前公开版本已经支持：

- 多个微信账号接入同一个 OpenClaw Gateway
- 默认一个微信对应一个 OpenClaw agent
- 本地控制台统一管理二维码登录和渠道状态
- 默认隔离聊天上下文
- 扫码确认后自动触发 channel reload，失败时再手动重启兜底

本次版本不处理旧共享模式测试数据迁移。如果你是从早期私有版本升级，建议直接重新扫码接入。

## 软件演示

<img src="./docs/weclawbot-ex-console-preview.png" alt="WeClawBot-ex 控制台预览" width="980" />

## 独立 Agent 效果演示

下面这两张图是两个不同手机微信接入同一个龙虾机器人Gateway的实际效果。它们分别绑定到了不同的独立agent，因此工作区、身份信息和记忆都是分开的。

<table>
  <tr>
    <td align="center" width="50%">
      <img src="./docs/weclawbot-ex-wechat-agent-a.jpg" alt="手机微信 A 绑定独立 agent" width="280" />
      <div><strong>手机 A -> Agent A</strong></div>
      <div><code>workspace-wx-09c653a7</code></div>
      <div>身份和记忆各自独立。</div>
    </td>
    <td align="center" width="50%">
      <img src="./docs/weclawbot-ex-wechat-agent-b.png" alt="手机微信 B 绑定独立 agent" width="280" />
      <div><strong>手机 B -> Agent B</strong></div>
      <div><code>workspace-wx-847277d3</code></div>
      <div>与手机 A 完全分开。</div>
    </td>
  </tr>
</table>

## 快速开始

### 前置条件

- Node.js >= 22
- 已安装 [OpenClaw](https://docs.openclaw.ai/install) `>= 2026.3.12`（`openclaw` 命令可用）

### 安装

```bash
git clone https://github.com/ImGoodBai/WeClawBot-ex.git
cd WeClawBot-ex
openclaw plugins install .
```

如果你本地之前已经装过官方 `openclaw-weixin` 插件，测试 WeClawBot-ex 前请先移除或禁用它。当前两个插件仍然共用同一个运行时 channel id（`openclaw-weixin`），同时加载会发生 channel 冲突。

同一个 OpenClaw profile 里，建议保持下面这种状态：

- `plugins.entries.weclawbot-ex.enabled = true`
- `plugins.entries.openclaw-weixin.enabled = false`

如果你确实要两边都保留，请拆到不同的 profile / 不同的 `OPENCLAW_STATE_DIR`。

### 命名说明

当前版本为了兼容运行时，仍然保留下面这几套标识：

- 产品名 / 仓库名：`WeClawBot-ex`
- npm 包名 + 插件配置键：`weclawbot-ex`
- 渠道配置键：`channels.openclaw-weixin`

所以日志里如果同时出现这几个名字，不代表装错仓库，这是当前版本的兼容口径。

### 运行

默认安装完成后，不需要再手工写一大段配置就能启动：

```bash
openclaw gateway
```

然后打开 **http://127.0.0.1:19120/**。

### 配置参考

插件级配置写在 `openclaw.json` 的 `channels.openclaw-weixin` 下。

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `agentBinding.enabled` | `boolean` | `true` | 是否启用一微信一 agent |
| `agentBinding.maxAgents` | `number` | `20` | 独立 agent 上限，超过后新用户回落到 `main` |
| `demoService.enabled` | `boolean` | `true` | 是否启动本地 Web 控制台 |
| `demoService.port` | `number` | `19120` | 控制台端口 |
| `demoService.bind` | `string` | `127.0.0.1` | 控制台绑定地址 |
| `demoService.restartCommand` | `string` | `openclaw gateway restart` | 诊断面板显示的手动重启命令 |
| `baseUrl` | `string` | `https://ilinkai.weixin.qq.com` | 微信 iLink API 地址 |
| `cdnBaseUrl` | `string` | `https://novac2c.cdn.weixin.qq.com/c2c` | 媒体 CDN 地址 |
| `logUploadUrl` | `string` | `-` | 可选日志上传地址 |

### 使用

1. 启动 OpenClaw Gateway
2. 打开 **http://127.0.0.1:19120/**
3. 点击 **添加微信渠道** — 用微信扫码并在手机上确认
4. 扫码成功后等待几秒，插件会尝试自动刷新微信通道
5. 如果新账号仍然没有上线，再执行 `openclaw gateway restart`
6. 用该微信发一条消息 — 对应绑定的 AI agent 自动回复

每添加一个微信号，重复第 3 步即可。

## FAQ 与架构说明

- FAQ：[docs/faq.md](./docs/faq.md)
- 工作原理与隔离边界：[docs/architecture.md](./docs/architecture.md)

## 排障

- `WARNING: Plugin "... contains dangerous code patterns"` 当前在 OpenClaw 里只是告警，不会因为这条扫描提示直接拦截安装。
- 如果看到 `npm install failed`，必须拿到完整 npm stderr 才能确认根因。
- 先检查 `node -v`。当前插件要求 Node.js `>= 22`。
- 再检查 `openclaw --version`。当前版本目标兼容范围是 OpenClaw `>= 2026.3.12`。
- 如果你刚从 GitHub 拉了新代码，还要重新执行一次 `openclaw plugins install .`。OpenClaw 实际运行的是 `~/.openclaw/extensions` 里的已安装副本，不是当前工作目录。
- 如果插件安装成功但管理端没起来，先确认 `channels.openclaw-weixin.demoService.enabled=true`，然后重启 Gateway。
- 如果管理端还是起不来，再确认本地没有同时安装官方 `openclaw-weixin` 插件。
- 如果扫码已经成功，但新账号还是收不到消息，先等自动刷新完成；还不行再使用诊断面板里的手动重启命令。
- 如果旧运行时上 PNG 二维码渲染不可用，控制台会自动退回到 SVG data URL，这不影响扫码登录流程。

## 质量门

在提交或合并变更前，至少执行：

```bash
npm run test:unit
npm run test:smoke
npm run test:gate
npm run test:gate:full
```

当前自动化覆盖的重点是：

- 配置触发式 channel reload 与手动降级
- 账号聚合快照和会话隔离诊断
- 控制台页面渲染 smoke
- 本地 demo service 健康检查
- 不依赖真实微信设备的 mock 二维码流程

当前默认的关门命令是 `npm run test:gate`。
`npm run test:gate:full` 会额外执行 `typecheck`，等仓库把上游派生导入彻底独立化后，再把它提升为默认门禁。

## 工作原理

```
微信 A <-> WeClawBot-ex <-> OpenClaw Agent A
微信 B <-> WeClawBot-ex <-> OpenClaw Agent B
微信 C <-> WeClawBot-ex <-> OpenClaw Agent C
```

- 基于官方 `@tencent-weixin/openclaw-weixin` 插件 (v1.0.2) 的 fork
- 扩展了 QR 登录模块，支持多会话并发管理
- 新增本地 Web 管理界面（`src/service/`）
- 默认每个微信账号的聊天上下文分开
- 每个稳定微信用户默认固定绑定到独立 OpenClaw agent
- agent workspace 会随 agent id 分开
- 当前版本的 tools、副作用运行环境在宿主层仍然共享

如果你重点关心“数据会不会串”，请直接看 [docs/architecture.md](./docs/architecture.md)。简化口径是：

- 默认：一微信一 agent
- 兜底：只有在独立绑定失败时才退回共享 `main`
- 后续：更彻底的 workspace / tools / runtime 隔离

## 相比官方 ClawBot 增加了什么

| | 官方 `openclaw-weixin` | WeClawBot-ex |
|---|---|---|
| 多账号运行 | 底层支持，主要通过 CLI | 支持，并提供统一 Web 控制台 |
| Agent 绑定 | 主要靠人工约定或共享模式 | 默认一微信对应一个独立 agent |
| 扫码体验 | 终端输出 | 浏览器二维码 + 实时状态卡片 |
| 账号状态可观测 | 主要靠日志和本地状态 | 面板聚合展示 + 重扫入口 |
| 冷却诊断 | 需手动排查 | 内置 `-14` 冷却可见 |
| 聊天隔离 | 需要额外手动配置 | 默认开启 |

## 维护边界

- 上游协议层和运行层视为冻结
- 后续只继续迭代我们自己的部分：`src/service/`、插件包装层、安装文档
- 除非遇到兼容性阻塞，否则不再修改上游派生文件

## 路线图

### 更强的隔离能力

- [x] 一微信一 Agent
- [ ] Tool / runtime side-effect 隔离
- [ ] 更硬的租户边界

### 商业化分发

- [ ] 可分享二维码（扫码即接入）
- [ ] 按微信入口计费
- [ ] 插件付费分发与商业化工作流

## 常见问题

### 官方插件不是也支持多个微信吗？

底层运行骨架是支持的。WeClawBot-ex 不是重新发明多账号，而是把官方已有的运行骨架做成了更适合扫码接入、管理、诊断和对外分发的产品化版本。

### 现在的数据隔离到哪一层？

当前默认已经是一微信一 agent，而且 agent workspace 会随 agent id 分开。但这还不是完整租户级硬隔离，因为 tools 和运行副作用还没有完全隔离。

### 当前是不是一微信对应一个 agent？

是，当前仓库默认就是。共享 agent 只作为独立绑定失败时的兜底；更彻底的 workspace/tool 隔离仍然在后续阶段。

## 更新记录

完整变更记录见 [CHANGELOG.zh_CN.md](./CHANGELOG.zh_CN.md)。

### 2026.3.23

- 默认一微信一 Agent：每个微信用户默认绑定独立 Agent，聊天内容不再串线
- 零配置启动：安装后直接 `openclaw gateway`，会话隔离和 Agent 绑定自动生效
- 重扫不丢绑定：同一微信重新扫码后，仍然回到之前绑定的 Agent
- 配置参考表：README 新增全部可配字段说明
- 架构文档和 FAQ：正面回答“和官方插件什么区别”“数据隔离到哪一层”
- 自动化质量门：`npm run test:gate` 覆盖绑定逻辑、QR 流程和控制台渲染

## 许可证

MIT — 详见 [LICENSE](./LICENSE) 和 [NOTICE](./NOTICE) 中的上游声明。

## 微信交流群

扫码加入微信 ClawBot 交流群：

<img src="./docs/weclawbot-ex-wechat-group-qr.jpg" alt="WeClawBot-ex 微信交流群二维码" width="360" />
