import { Effect } from "effect"
import { PluginV2 } from "../../plugin"

export const CerebrasPlugin = {
  id: PluginV2.ID.make("cerebras"),
  definition: Effect.gen(function* () {
    return {
      "aisdk.sdk": Effect.fn(function* (evt) {
        if (evt.package !== "@ai-sdk/cerebras") return
        const mod = yield* Effect.promise(() => import("@ai-sdk/cerebras"))
        evt.sdk = mod.createCerebras(evt.options)
      }),
    } satisfies PluginV2.HookFunctions
  }),
}
