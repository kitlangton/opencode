import { Effect } from "effect"
import { PluginV2 } from "../../plugin"

export const AlibabaPlugin = {
  id: PluginV2.ID.make("alibaba"),
  definition: Effect.gen(function* () {
    return {
      "aisdk.sdk": Effect.fn(function* (evt) {
        if (evt.package !== "@ai-sdk/alibaba") return
        const mod = yield* Effect.promise(() => import("@ai-sdk/alibaba"))
        evt.sdk = mod.createAlibaba(evt.options)
      }),
    } satisfies PluginV2.HookFunctions
  }),
}
