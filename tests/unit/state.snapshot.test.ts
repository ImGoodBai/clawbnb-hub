import fs from "node:fs";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { pauseSession, _resetForTest as resetSessionGuard } from "../../src/api/session-guard.js";
import { buildDemoAccountsSnapshot } from "../../src/service/state.js";
import { createTempOpenClawEnv } from "../helpers/temp-env.js";

let env: ReturnType<typeof createTempOpenClawEnv>;

function writeAccount(accountId: string, data: Record<string, unknown>): void {
  const accountsDir = path.join(env.stateDir, "openclaw-weixin", "accounts");
  fs.mkdirSync(accountsDir, { recursive: true });
  fs.writeFileSync(
    path.join(accountsDir, `${accountId}.json`),
    `${JSON.stringify(data, null, 2)}\n`,
    "utf-8",
  );
}

describe("demo account snapshot", () => {
  beforeEach(() => {
    env = createTempOpenClawEnv();
  });

  afterEach(() => {
    resetSessionGuard();
    env.cleanup();
  });

  it("groups duplicate records and emits isolation diagnostics", () => {
    const stateDir = path.join(env.stateDir, "openclaw-weixin");
    fs.mkdirSync(stateDir, { recursive: true });
    fs.writeFileSync(
      path.join(stateDir, "accounts.json"),
      JSON.stringify(["wx-user-a-1", "wx-user-a-2", "wx-user-b-1"], null, 2),
      "utf-8",
    );

    writeAccount("wx-user-a-1", {
      token: "token-a-1",
      userId: "user-a",
      savedAt: "2026-03-23T09:00:00.000Z",
    });
    writeAccount("wx-user-a-2", {
      token: "token-a-2",
      userId: "user-a",
      savedAt: "2026-03-23T10:00:00.000Z",
    });
    writeAccount("wx-user-b-1", {
      token: "token-b-1",
      savedAt: "2026-03-23T08:00:00.000Z",
    });

    pauseSession("wx-user-a-2");

    const snapshot = buildDemoAccountsSnapshot({
      session: { dmScope: "main" },
    } as never);

    expect(snapshot.summary.totalStoredRecords).toBe(3);
    expect(snapshot.summary.uniqueChannels).toBe(2);
    expect(snapshot.summary.duplicateChannelCount).toBe(1);
    expect(snapshot.summary.cooldownChannelCount).toBe(1);
    expect(snapshot.channels[0]?.linkedAccountCount).toBe(2);
    expect(snapshot.channels[0]?.cooldownRecordCount).toBe(1);
    expect(snapshot.diagnostics.some((item) => item.kind === "session-scope")).toBe(true);
    expect(snapshot.diagnostics.some((item) => item.kind === "duplicate")).toBe(true);
    expect(snapshot.diagnostics.some((item) => item.kind === "cooldown")).toBe(true);
    expect(snapshot.diagnostics.some((item) => item.kind === "missing-user-id")).toBe(true);
  });
});

