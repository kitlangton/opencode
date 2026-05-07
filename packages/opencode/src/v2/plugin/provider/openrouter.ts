import { Effect } from "effect"
import { PluginV2 } from "../../plugin"
import { ProviderV2 } from "../../provider"

export const OpenRouterPlugin = PluginV2.define({
  id: PluginV2.ID.make("openrouter"),
  effect: Effect.gen(function* () {
    return {
      "provider.update": Effect.fn(function* (evt) {
        if (evt.provider.id !== ProviderV2.ID.openrouter) return
        evt.provider.options.headers["HTTP-Referer"] = "https://opencode.ai/"
        evt.provider.options.headers["X-Title"] = "opencode"
      }),
      "aisdk.sdk": Effect.fn(function* (evt) {
        if (evt.package !== "@openrouter/ai-sdk-provider") return
        const mod = yield* Effect.promise(() => import("@openrouter/ai-sdk-provider"))
        evt.sdk = mod.createOpenRouter(evt.options)
      }),
    }
  }),
})
