import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

import { normalizeAccountId } from "openclaw/plugin-sdk/core";
import type { PluginLogger } from "openclaw/plugin-sdk/core";

import {
  DEFAULT_BASE_URL,
  loadWeixinAccount,
  registerWeixinAccountId,
  saveWeixinAccount,
} from "../auth/accounts.js";
import {
  DEFAULT_ILINK_BOT_TYPE,
  getWeixinLoginSnapshot,
  pollWeixinLoginStatusOnce,
  startWeixinLoginWithQr,
} from "../auth/login-qr.js";
import { resolveWeixinDemoServiceConfig, type WeixinDemoServiceConfig } from "./config.js";
import { renderDemoPage } from "./page.js";
import { renderQrImageDataUrl } from "./qr-image.js";
import { buildDemoAccountsSnapshot, listRecentDemoErrors } from "./state.js";

type HttpServerDeps = {
  logger: PluginLogger;
  config: import("openclaw/plugin-sdk/core").OpenClawConfig;
};

export class WeixinDemoHttpServer {
  private readonly logger: PluginLogger;
  private readonly config: import("openclaw/plugin-sdk/core").OpenClawConfig;
  private readonly serviceConfig: WeixinDemoServiceConfig;
  private server: Server | null = null;

  constructor(params: HttpServerDeps) {
    this.logger = params.logger;
    this.config = params.config;
    this.serviceConfig = resolveWeixinDemoServiceConfig(params.config);
  }

  async start(): Promise<void> {
    if (!this.serviceConfig.enabled) {
      this.logger.info("[WeClawBot-ex] demo service disabled");
      return;
    }
    if (this.server) {
      return;
    }
    this.server = createServer((req, res) => {
      void this.handleRequest(req, res);
    });
    await new Promise<void>((resolve, reject) => {
      this.server?.once("error", reject);
      this.server?.listen(this.serviceConfig.port, this.serviceConfig.bind, () => resolve());
    });
    this.logger.info(
      `[WeClawBot-ex] demo service listening on http://${this.serviceConfig.bind}:${this.serviceConfig.port}`,
    );
  }

  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }
    const server = this.server;
    this.server = null;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const url = new URL(req.url || "/", `http://${this.serviceConfig.bind}:${this.serviceConfig.port}`);
      if (req.method === "GET" && url.pathname === "/") {
        this.respondText(res, 200, renderDemoPage(), "text/html; charset=utf-8");
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/health") {
        const snapshot = buildDemoAccountsSnapshot(this.config);
        this.respondJson(res, 200, {
          ok: true,
          gateway: {
            status: "online",
          },
          session: {
            dmScope: snapshot.isolation.dmScope,
            secure: snapshot.isolation.secure,
            label: snapshot.isolation.label,
          },
          service: {
            bind: this.serviceConfig.bind,
            port: this.serviceConfig.port,
            pageUrl: `http://${this.serviceConfig.bind}:${this.serviceConfig.port}/`,
          },
          restart: {
            mode: "manual",
            command: this.serviceConfig.restartCommand,
          },
        });
        return;
      }
      if (req.method === "POST" && url.pathname === "/api/qr/create") {
        const body = await this.readJsonBody(req);
        const accountId =
          typeof body.accountId === "string" && body.accountId.trim() ? body.accountId.trim() : undefined;
        const savedBaseUrl = accountId ? loadWeixinAccount(accountId)?.baseUrl?.trim() : "";
        const result = await startWeixinLoginWithQr({
          accountId,
          apiBaseUrl: savedBaseUrl || DEFAULT_BASE_URL,
          botType: DEFAULT_ILINK_BOT_TYPE,
          force: true,
        });
        const snapshot = getWeixinLoginSnapshot(result.sessionKey);
        this.respondJson(res, 200, {
          ok: Boolean(result.qrcodeUrl),
          message: result.message,
          sessionKey: result.sessionKey,
          qrcodeUrl: result.qrcodeUrl,
          qrImageDataUrl: result.qrcodeUrl ? renderQrImageDataUrl(result.qrcodeUrl) : undefined,
          status: snapshot?.status ?? "waiting",
          expiresAt: snapshot?.expiresAt,
        });
        return;
      }

      const qrStatusMatch = req.method === "GET"
        ? url.pathname.match(/^\/api\/qr\/([^/]+)\/status$/)
        : null;
      if (qrStatusMatch) {
        const sessionKey = decodeURIComponent(qrStatusMatch[1] || "");
        const result = await pollWeixinLoginStatusOnce({ sessionKey });
        if (result.connected && result.botToken && result.accountId) {
          const normalizedId = normalizeAccountId(result.accountId);
          saveWeixinAccount(normalizedId, {
            token: result.botToken,
            baseUrl: result.baseUrl,
            userId: result.userId,
          });
          registerWeixinAccountId(normalizedId);
        }
        this.respondJson(res, 200, {
          ...result,
          qrImageDataUrl: result.qrcodeUrl ? renderQrImageDataUrl(result.qrcodeUrl) : undefined,
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/accounts") {
        this.respondJson(res, 200, buildDemoAccountsSnapshot(this.config));
        return;
      }

      const reloginMatch = req.method === "POST"
        ? url.pathname.match(/^\/api\/accounts\/([^/]+)\/relogin$/)
        : null;
      if (reloginMatch) {
        const accountId = decodeURIComponent(reloginMatch[1] || "");
        const savedBaseUrl = loadWeixinAccount(accountId)?.baseUrl?.trim() || DEFAULT_BASE_URL;
        const result = await startWeixinLoginWithQr({
          accountId,
          apiBaseUrl: savedBaseUrl,
          botType: DEFAULT_ILINK_BOT_TYPE,
          force: true,
        });
        const snapshot = getWeixinLoginSnapshot(result.sessionKey);
        this.respondJson(res, 200, {
          ok: Boolean(result.qrcodeUrl),
          message: result.message,
          sessionKey: result.sessionKey,
          qrcodeUrl: result.qrcodeUrl,
          qrImageDataUrl: result.qrcodeUrl ? renderQrImageDataUrl(result.qrcodeUrl) : undefined,
          status: snapshot?.status ?? "waiting",
        });
        return;
      }

      if (req.method === "GET" && url.pathname === "/api/errors") {
        this.respondJson(res, 200, {
          errors: await listRecentDemoErrors(),
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/gateway/restart") {
        this.respondJson(res, 200, {
          mode: "manual",
          command: this.serviceConfig.restartCommand,
          message: "Run the restart command after scan success.",
        });
        return;
      }

      this.respondJson(res, 404, { error: "not_found" });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[WeClawBot-ex] demo service error: ${message}`);
      this.respondJson(res, 500, { error: message });
    }
  }

  private async readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    if (chunks.length === 0) {
      return {};
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
  }

  private respondJson(res: ServerResponse, statusCode: number, body: Record<string, unknown>): void {
    const raw = `${JSON.stringify(body, null, 2)}\n`;
    res.statusCode = statusCode;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.setHeader("cache-control", "no-store");
    res.end(raw);
  }

  private respondText(
    res: ServerResponse,
    statusCode: number,
    body: string,
    contentType: string,
  ): void {
    res.statusCode = statusCode;
    res.setHeader("content-type", contentType);
    res.setHeader("cache-control", "no-store");
    res.end(body);
  }
}
