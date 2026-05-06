import { Effect } from "effect"
import { PluginV2 } from "../../plugin"

export const MistralPlugin = {
  id: PluginV2.ID.make("mistral"),
  definition: Effect.gen(function* () {
    return {
      "aisdk.sdk": Effect.fn(function* (evt) {
        if (evt.package !== "@ai-sdk/mistral") return
        const mod = yield* Effect.promise(() => import("@ai-sdk/mistral"))
        evt.sdk = mod.createMistral(evt.options)
      }),
    } satisfies PluginV2.HookFunctions
  }),
}
