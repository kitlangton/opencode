import { Effect } from "effect"
import { PluginV2 } from "../../plugin"

export const TogetherAIPlugin = {
  id: PluginV2.ID.make("togetherai"),
  definition: Effect.gen(function* () {
    return {
      "aisdk.sdk": Effect.fn(function* (evt) {
        if (evt.package !== "@ai-sdk/togetherai") return
        const mod = yield* Effect.promise(() => import("@ai-sdk/togetherai"))
        evt.sdk = mod.createTogetherAI(evt.options)
      }),
    } satisfies PluginV2.HookFunctions
  }),
}
