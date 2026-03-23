import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { buildChannelConfigSchema } from "openclaw/plugin-sdk";

import { weixinPlugin } from "./src/channel.js";
import { WeixinDemoPluginConfigSchema } from "./src/config/config-schema.js";
import { registerWeixinCli } from "./src/log-upload.js";
import { setWeixinRuntime } from "./src/runtime.js";
import { createWeixinDemoService } from "./src/service/index.js";

const plugin = {
  id: "weclawbot-ex",
  name: "WeClawBot-ex",
  description: "WeClawBot-ex multi-account Weixin plugin with local control console",
  configSchema: buildChannelConfigSchema(WeixinDemoPluginConfigSchema),
  register(api: OpenClawPluginApi) {
    if (!api?.runtime) {
      throw new Error("[weixin] api.runtime is not available in register()");
    }
    setWeixinRuntime(api.runtime);

    api.registerChannel({ plugin: weixinPlugin });
    api.registerCli(({ program, config }) => registerWeixinCli({ program, config }), {
      commands: ["openclaw-weixin"],
    });
    api.registerService(createWeixinDemoService(api));
  },
};

export default plugin;
