import { Effect } from "effect"
import { PluginV2 } from "../../plugin"

export const AnthropicPlugin = PluginV2.define({
  id: PluginV2.ID.make("anthropic"),
  effect: Effect.gen(function* () {
    return {
      "aisdk.sdk": Effect.fn(function* (evt) {
        if (evt.package !== "@ai-sdk/anthropic") return
        const mod = yield* Effect.promise(() => import("@ai-sdk/anthropic"))
        evt.sdk = mod.createAnthropic(evt.options)
      }),
    }
  }),
})
