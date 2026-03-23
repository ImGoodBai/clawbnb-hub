import fs from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { invokeHttpHandler } from "../helpers/http.js";
import { createTempOpenClawEnv } from "../helpers/temp-env.js";

const loginQrMocks = vi.hoisted(() => ({
  start: vi.fn(async () => ({
    qrcodeUrl: "https://mock.weixin/qr/session-1",
    message: "QR ready",
    sessionKey: "session-1",
  })),
  snapshot: vi.fn((sessionKey: string) => ({
    sessionKey,
    status: "waiting",
    expiresAt: "2026-03-23T12:00:00.000Z",
  })),
  poll: vi.fn(async () => ({
    connected: true,
    botToken: "token-123",
    accountId: "bot@im.bot",
    baseUrl: "https://ilinkai.weixin.qq.com",
    userId: "wx-user-1",
    status: "confirmed",
    message: "confirmed",
    qrcodeUrl: "https://mock.weixin/qr/session-1",
  })),
}));

vi.mock("../../src/auth/login-qr.js", () => ({
  DEFAULT_ILINK_BOT_TYPE: "iLinkBot",
  startWeixinLoginWithQr: loginQrMocks.start,
  getWeixinLoginSnapshot: loginQrMocks.snapshot,
  pollWeixinLoginStatusOnce: loginQrMocks.poll,
}));

import { WeixinDemoHttpServer } from "../../src/service/http-server.js";

let env: ReturnType<typeof createTempOpenClawEnv>;
let server: WeixinDemoHttpServer | null = null;

describe("mock qr flow smoke", () => {
  beforeEach(() => {
    const port = 19120;
    env = createTempOpenClawEnv({
      session: {
        dmScope: "per-account-channel-peer",
      },
      channels: {
        "openclaw-weixin": {
          demoService: {
            enabled: true,
            bind: "127.0.0.1",
            port,
            restartCommand: "openclaw gateway restart",
          },
        },
      },
    });

    server = new WeixinDemoHttpServer({
      logger: {
        info() {},
        warn() {},
        error() {},
        debug() {},
      } as never,
      config: {
        session: {
          dmScope: "per-account-channel-peer",
        },
        channels: {
          "openclaw-weixin": {
            demoService: {
              enabled: true,
              bind: "127.0.0.1",
              port,
              restartCommand: "openclaw gateway restart",
            },
          },
        },
      } as never,
    });

  });

  afterEach(async () => {
    if (server) {
      await server.stop();
      server = null;
    }
    env?.cleanup();
    vi.clearAllMocks();
  });

  it("creates a QR session and persists the account on confirm", async () => {
    const createResult = await invokeHttpHandler(server as never, {
      method: "POST",
      url: "/api/qr/create",
      body: {},
    });

    expect(createResult.statusCode).toBe(200);
    expect(createResult.json.ok).toBe(true);
    expect(createResult.json.sessionKey).toBe("session-1");
    expect(createResult.json.status).toBe("waiting");

    const statusResult = await invokeHttpHandler(server as never, {
      method: "GET",
      url: `/api/qr/${encodeURIComponent("session-1")}/status`,
    });

    expect(statusResult.statusCode).toBe(200);
    expect(statusResult.json.connected).toBe(true);
    expect(statusResult.json.status).toBe("confirmed");
    expect(statusResult.json.activation.mode).toBe("auto");
    expect(statusResult.json.activation.triggered).toBe(true);

    const normalizedAccountId = "bot-im-bot";
    const accountPath = path.join(
      env.stateDir,
      "openclaw-weixin",
      "accounts",
      `${normalizedAccountId}.json`,
    );
    const indexPath = path.join(env.stateDir, "openclaw-weixin", "accounts.json");
    const config = JSON.parse(fs.readFileSync(env.configPath, "utf-8")) as {
      channels?: {
        "openclaw-weixin"?: {
          demoService?: { reloadNonce?: string };
        };
      };
    };

    expect(fs.existsSync(accountPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(indexPath, "utf-8"))).toContain(normalizedAccountId);
    expect(config.channels?.["openclaw-weixin"]?.demoService?.reloadNonce).toMatch(
      /^\d{4}-\d{2}-\d{2}T/,
    );
  });
});
