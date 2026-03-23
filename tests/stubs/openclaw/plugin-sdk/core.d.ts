export type OpenClawConfig = Record<string, any>;

export type PluginLogger = {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
  debug(message: string): void;
};

export type OpenClawPluginApi = {
  runtime?: any;
  registerChannel(params: any): void;
  registerCli(register: any, options?: any): void;
  registerService(service: any): void;
};

export type OpenClawPluginService = {
  id: string;
  start?: (ctx: any) => Promise<void> | void;
  stop?: () => Promise<void> | void;
};

export declare function buildChannelConfigSchema(schema: any): any;
export declare function normalizeAccountId(input: string): string;

