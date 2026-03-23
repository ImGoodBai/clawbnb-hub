export type OpenClawConfig = Record<string, any>;

export type ReplyPayload = {
  text?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
};

export type ChannelAccountSnapshot = Record<string, any>;

export type PluginRuntime = {
  channel: any;
};

export type ChannelPlugin<T = any> = {
  id: string;
  config: any;
  gateway?: any;
  auth?: any;
  reload?: any;
};

