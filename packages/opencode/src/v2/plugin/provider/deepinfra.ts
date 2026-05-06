import { Effect } from "effect"
import { PluginV2 } from "../../plugin"

export const DeepInfraPlugin = {
  id: PluginV2.ID.make("deepinfra"),
  definition: Effect.gen(function* () {
    return {
      "aisdk.sdk": Effect.fn(function* (evt) {
        if (evt.package !== "@ai-sdk/deepinfra") return
        const mod = yield* Effect.promise(() => import("@ai-sdk/deepinfra"))
        evt.sdk = mod.createDeepInfra(evt.options)
      }),
    } satisfies PluginV2.HookFunctions
  }),
}
