// Based on @tencent-weixin/openclaw-weixin v1.0.2.
// Modifications: demoService schema for the local web console.

import { z } from "zod";

import { CDN_BASE_URL, DEFAULT_BASE_URL } from "../auth/accounts.js";

// ---------------------------------------------------------------------------
// Zod config schema
// ---------------------------------------------------------------------------

const weixinAccountSchema = z.object({
  name: z.string().optional(),
  enabled: z.boolean().optional(),
  baseUrl: z.string().default(DEFAULT_BASE_URL),
  cdnBaseUrl: z.string().default(CDN_BASE_URL),
  routeTag: z.number().optional(),
});

/** Top-level weixin config schema (token is stored in credentials file, not config). */
export const WeixinConfigSchema = weixinAccountSchema.extend({
  accounts: z.record(z.string(), weixinAccountSchema).optional(),
  /** Default URL for `openclaw openclaw-weixin logs-upload`. Set via `openclaw config set channels.openclaw-weixin.logUploadUrl <url>`. */
  logUploadUrl: z.string().optional(),
});

const DemoServiceSchema = z.object({
  enabled: z.boolean().optional(),
  bind: z.string().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  restartCommand: z.string().optional(),
});

export const WeixinDemoPluginConfigSchema = WeixinConfigSchema.extend({
  demoService: DemoServiceSchema.optional(),
});
