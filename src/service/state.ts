import fs from "node:fs/promises";

import type { OpenClawConfig } from "openclaw/plugin-sdk/core";

import {
  listIndexedWeixinAccountIds,
  loadWeixinAccount,
} from "../auth/accounts.js";
import { getRemainingPauseMs, isSessionPaused, SESSION_EXPIRED_ERRCODE } from "../api/session-guard.js";
import {
  getWeixinUserAgentBinding,
  resolveWeixinAgentBindingConfig,
} from "./user-agent-binding.js";
import { logger } from "../util/logger.js";

export type DemoAccountRecord = {
  accountId: string;
  accountShortId: string;
  configured: boolean;
  baseUrl?: string;
  userId?: string;
  userLabel: string;
  savedAt?: string;
  cooldownActive: boolean;
  cooldownRemainingMinutes: number;
  cooldownErrcode?: number;
};

export type DemoChannelSummary = {
  channelKey: string;
  identityLabel: string;
  userId?: string;
  primaryAccountId: string;
  primaryAccountShortId: string;
  latestSavedAt?: string;
  linkedAccountCount: number;
  duplicateRecordCount: number;
  cooldownActive: boolean;
  cooldownRemainingMinutes: number;
  cooldownRecordCount: number;
  cooldownErrcode?: number;
  agentId: string;
  bindingMode: "dedicated" | "shared";
  bindingEnabled: boolean;
  bindingFallback: boolean;
  bindingReason?: string;
  records: DemoAccountRecord[];
};

export type DemoDiagnosticItem = {
  kind: "cooldown" | "duplicate" | "missing-user-id" | "session-scope";
  severity: "danger" | "warn" | "info";
  title: string;
  message: string;
};

export type DemoIsolationState = {
  dmScope: string;
  secure: boolean;
  label: string;
};

export type DemoAccountsSnapshot = {
  summary: {
    totalStoredRecords: number;
    uniqueChannels: number;
    duplicateChannelCount: number;
    cooldownChannelCount: number;
    dedicatedAgentCount: number;
  };
  isolation: DemoIsolationState;
  channels: DemoChannelSummary[];
  records: DemoAccountRecord[];
  diagnostics: DemoDiagnosticItem[];
};

export type DemoErrorEntry = {
  time: string;
  level: string;
  message: string;
};

function shortAccountId(accountId: string): string {
  return accountId.length > 18 ? `${accountId.slice(0, 6)}...${accountId.slice(-6)}` : accountId;
}

function maskUserId(userId?: string): string {
  const value = userId?.trim();
  if (!value) {
    return "Unidentified Weixin user";
  }
  if (value.length <= 18) {
    return value;
  }
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function toTimestamp(value?: string): number {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareSavedAtDesc(a: { savedAt?: string }, b: { savedAt?: string }): number {
  return toTimestamp(b.savedAt) - toTimestamp(a.savedAt);
}

function compareLatestSavedAtDesc(
  a: { latestSavedAt?: string },
  b: { latestSavedAt?: string },
): number {
  return toTimestamp(b.latestSavedAt) - toTimestamp(a.latestSavedAt);
}

function buildAccountRecords(): DemoAccountRecord[] {
  return listIndexedWeixinAccountIds()
    .map((accountId) => {
      const account = loadWeixinAccount(accountId);
      const cooldownRemainingMs = getRemainingPauseMs(accountId);
      const cooldownActive = isSessionPaused(accountId);
      return {
        accountId,
        accountShortId: shortAccountId(accountId),
        configured: Boolean(account?.token),
        baseUrl: account?.baseUrl,
        userId: account?.userId,
        userLabel: maskUserId(account?.userId),
        savedAt: account?.savedAt,
        cooldownActive,
        cooldownRemainingMinutes: Math.ceil(cooldownRemainingMs / 60_000),
        cooldownErrcode: cooldownActive ? SESSION_EXPIRED_ERRCODE : undefined,
      };
    })
    .sort(compareSavedAtDesc);
}

function buildIsolationState(cfg?: OpenClawConfig): DemoIsolationState {
  const dmScope = cfg?.session?.dmScope ?? "main";
  if (dmScope === "per-account-channel-peer") {
    return {
      dmScope,
      secure: true,
      label: "账号级会话隔离",
    };
  }
  if (dmScope === "per-channel-peer") {
    return {
      dmScope,
      secure: true,
      label: "按渠道与联系人隔离",
    };
  }
  if (dmScope === "per-peer") {
    return {
      dmScope,
      secure: true,
      label: "按联系人隔离",
    };
  }
  return {
    dmScope,
    secure: false,
    label: "共享主会话",
  };
}

export function buildDemoAccountsSnapshot(cfg?: OpenClawConfig): DemoAccountsSnapshot {
  const records = buildAccountRecords();
  const isolation = buildIsolationState(cfg);
  const agentBinding = resolveWeixinAgentBindingConfig(cfg);
  const grouped = new Map<string, DemoAccountRecord[]>();

  for (const record of records) {
    const key = record.userId?.trim() || record.accountId;
    const current = grouped.get(key) ?? [];
    current.push(record);
    grouped.set(key, current);
  }

  const channels = [...grouped.entries()]
    .map(([channelKey, channelRecords]) => {
      const sortedRecords = [...channelRecords].sort(compareSavedAtDesc);
      const primary = sortedRecords[0];
      const cooldownRecordCount = sortedRecords.filter((record) => record.cooldownActive).length;
      const binding = getWeixinUserAgentBinding({
        userId: primary.userId,
        accountId: primary.accountId,
        config: cfg,
      });
      return {
        channelKey,
        identityLabel: primary.userLabel,
        userId: primary.userId,
        primaryAccountId: primary.accountId,
        primaryAccountShortId: primary.accountShortId,
        latestSavedAt: primary.savedAt,
        linkedAccountCount: sortedRecords.length,
        duplicateRecordCount: Math.max(0, sortedRecords.length - 1),
        cooldownActive: primary.cooldownActive,
        cooldownRemainingMinutes: primary.cooldownRemainingMinutes,
        cooldownRecordCount,
        cooldownErrcode: primary.cooldownActive ? primary.cooldownErrcode : undefined,
        agentId: binding.agentId,
        bindingMode: binding.mode,
        bindingEnabled: binding.enabled,
        bindingFallback: binding.fallback,
        bindingReason: binding.reason,
        records: sortedRecords,
      } satisfies DemoChannelSummary;
    })
    .sort(compareLatestSavedAtDesc);

  const diagnostics: DemoDiagnosticItem[] = [];

  if (!isolation.secure) {
    diagnostics.push({
      kind: "session-scope",
      severity: "danger",
      title: "Shared main session mode",
      message: `Direct messages currently share one main agent session (dmScope=${isolation.dmScope}). Use per-account-channel-peer before running multiple Weixin accounts in one Gateway.`,
    });
  }

  if (agentBinding.enabled) {
    const fallbackChannels = channels.filter((channel) => channel.bindingFallback);
    if (fallbackChannels.length > 0) {
      diagnostics.push({
        kind: "missing-user-id",
        severity: "warn",
        title: "Some channels still use the shared agent",
        message: `${fallbackChannels.length} channel(s) are still routed to ${fallbackChannels[0]?.agentId ?? "main"} because dedicated agent binding could not be completed.`,
      });
    }
  }

  for (const channel of channels) {
    if (channel.duplicateRecordCount > 0) {
      diagnostics.push({
        kind: "duplicate",
        severity: "info",
        title: "Duplicate history grouped",
        message: `${channel.identityLabel} has ${channel.linkedAccountCount} stored bot sessions. The newest one is shown as the active channel.`,
      });
    }
    if (channel.cooldownRecordCount > 0) {
      diagnostics.push({
        kind: "cooldown",
        severity: "danger",
        title: "Weixin cooldown detected",
        message: `${channel.identityLabel} has ${channel.cooldownRecordCount} session record(s) paused by errcode ${SESSION_EXPIRED_ERRCODE}. Affected sessions wait about 60 minutes before retry.`,
      });
    }
    if (!channel.userId) {
      diagnostics.push({
        kind: "missing-user-id",
        severity: "warn",
        title: "User identity missing",
        message: `${channel.primaryAccountShortId} has no stable Weixin userId saved yet, so it cannot be deduplicated confidently.`,
      });
    }
  }

  return {
    summary: {
      totalStoredRecords: records.length,
      uniqueChannels: channels.length,
      duplicateChannelCount: channels.filter((channel) => channel.duplicateRecordCount > 0).length,
      cooldownChannelCount: channels.filter((channel) => channel.cooldownRecordCount > 0).length,
      dedicatedAgentCount: channels.filter((channel) => channel.bindingMode === "dedicated").length,
    },
    isolation,
    channels,
    records,
    diagnostics,
  };
}

export async function listRecentDemoErrors(limit = 8): Promise<DemoErrorEntry[]> {
  try {
    const logPath = logger.getLogFilePath();
    const raw = await fs.readFile(logPath, "utf8");
    const lines = raw.trim().split("\n");
    const entries: DemoErrorEntry[] = [];
    const seen = new Set<string>();

    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = lines[index];
      if (!line) {
        continue;
      }
      try {
        const parsed = JSON.parse(line) as {
          "0"?: string;
          "1"?: string;
          time?: string;
          _meta?: { logLevelName?: string };
        };
        const loggerName = parsed["0"] ?? "";
        const level = parsed._meta?.logLevelName ?? "INFO";
        const message = parsed["1"] ?? "";
        if (!loggerName.includes("openclaw-weixin")) {
          continue;
        }
        if (level !== "ERROR" && level !== "WARN" && !message.includes(String(SESSION_EXPIRED_ERRCODE))) {
          continue;
        }
        const dedupeKey = `${level}|${message}`;
        if (seen.has(dedupeKey)) {
          continue;
        }
        seen.add(dedupeKey);
        entries.push({
          time: parsed.time ?? new Date().toISOString(),
          level,
          message,
        });
        if (entries.length >= limit) {
          break;
        }
      } catch {
        continue;
      }
    }

    return entries;
  } catch {
    return [];
  }
}
