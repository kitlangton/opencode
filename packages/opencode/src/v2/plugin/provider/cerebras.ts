import { Effect } from "effect"
import { PluginV2 } from "../../plugin"

export const CerebrasPlugin = PluginV2.define({
  id: PluginV2.ID.make("cerebras"),
  effect: Effect.gen(function* () {
    return {
      "aisdk.sdk": Effect.fn(function* (evt) {
        if (evt.package !== "@ai-sdk/cerebras") return
        const mod = yield* Effect.promise(() => import("@ai-sdk/cerebras"))
        evt.sdk = mod.createCerebras(evt.options)
      }),
    }
  }),
})
