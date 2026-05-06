import { Effect } from "effect"
import { ProviderV2 } from "../provider"
import { PluginV2 } from "../plugin"

export const OpenRouterPlugin = {
  id: PluginV2.ID.make("openrouter"),
  definition: Effect.gen(function* () {
    return {
      "provider.update": Effect.fn(function* (evt) {
        if (evt.provider.id !== ProviderV2.ID.openrouter) return
        evt.provider.options.headers["HTTP-Referer"] = "https://opencode.ai/"
        evt.provider.options.headers["X-Title"] = "opencode"
      }),
    } satisfies PluginV2.HookFunctions
  }),
}
