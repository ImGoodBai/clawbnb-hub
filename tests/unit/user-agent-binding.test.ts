import fs from "node:fs";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTempOpenClawEnv } from "../helpers/temp-env.js";
import { resolveOrRegisterWeixinUserAgent } from "../../src/service/user-agent-binding.js";

let env: ReturnType<typeof createTempOpenClawEnv>;

describe("user-agent binding", () => {
  beforeEach(() => {
    env = createTempOpenClawEnv({
      session: {
        dmScope: "per-account-channel-peer",
      },
      agents: {
        list: [{ id: "main" }],
      },
      channels: {
        "openclaw-weixin": {
          demoService: {
            enabled: true,
            bind: "127.0.0.1",
            port: 19120,
            restartCommand: "openclaw gateway restart",
          },
          agentBinding: {
            enabled: true,
            maxAgents: 20,
          },
        },
      },
    });
  });

  afterEach(() => {
    env.cleanup();
  });

  it("registers agents.list and bindings together for a new user", async () => {
    const result = await resolveOrRegisterWeixinUserAgent({
      userId: "wx-user-a",
      accountId: "bot-a-im-bot",
    });

    expect(result.mode).toBe("dedicated");
    expect(result.fallback).toBe(false);
    expect(result.created).toBe(true);
    expect(result.agentId).toMatch(/^wx-[0-9a-f]{8}$/);

    const updated = JSON.parse(fs.readFileSync(env.configPath, "utf-8")) as {
      agents?: { list?: Array<{ id?: string }> };
      bindings?: Array<{ match?: { channel?: string; accountId?: string }; agentId?: string }>;
    };
    const agentIds = (updated.agents?.list ?? []).map((item) => item.id);
    const binding = (updated.bindings ?? []).find((item) => item.match?.accountId === "bot-a-im-bot");

    expect(agentIds).toContain("main");
    expect(agentIds).toContain(result.agentId);
    expect(binding?.match?.channel).toBe("openclaw-weixin");
    expect(binding?.agentId).toBe(result.agentId);
  });

  it("keeps the same agent when the same user logs in again", async () => {
    const first = await resolveOrRegisterWeixinUserAgent({
      userId: "wx-user-a",
      accountId: "bot-a-im-bot",
    });
    const second = await resolveOrRegisterWeixinUserAgent({
      userId: "wx-user-a",
      accountId: "bot-a-v2-im-bot",
    });

    expect(second.agentId).toBe(first.agentId);
    expect(second.created).toBe(false);

    const mapPath = `${env.stateDir}/openclaw-weixin/user-agent-map.json`;
    const map = JSON.parse(fs.readFileSync(mapPath, "utf-8")) as {
      users?: Record<string, { activeAccountId?: string; historyAccountIds?: string[] }>;
    };
    const user = map.users?.["wx-user-a"];
    const updated = JSON.parse(fs.readFileSync(env.configPath, "utf-8")) as {
      bindings?: Array<{ match?: { accountId?: string }; agentId?: string }>;
    };
    const bindings = updated.bindings ?? [];

    expect(user?.activeAccountId).toBe("bot-a-v2-im-bot");
    expect(user?.historyAccountIds).toContain("bot-a-im-bot");
    expect(user?.historyAccountIds).toContain("bot-a-v2-im-bot");
    expect(bindings.some((item) => item.match?.accountId === "bot-a-im-bot")).toBe(false);
    expect(bindings.some((item) => item.match?.accountId === "bot-a-v2-im-bot" && item.agentId === first.agentId)).toBe(true);
  });

  it("falls back to the shared agent when userId is missing", async () => {
    const result = await resolveOrRegisterWeixinUserAgent({
      accountId: "bot-anon-im-bot",
    });

    expect(result.mode).toBe("shared");
    expect(result.fallback).toBe(true);
    expect(result.agentId).toBe("main");
  });
});
