import { Effect } from "effect"
import { PluginV2 } from "../../plugin"

export const CoherePlugin = {
  id: PluginV2.ID.make("cohere"),
  definition: Effect.gen(function* () {
    return {
      "aisdk.sdk": Effect.fn(function* (evt) {
        if (evt.package !== "@ai-sdk/cohere") return
        const mod = yield* Effect.promise(() => import("@ai-sdk/cohere"))
        evt.sdk = mod.createCohere(evt.options)
      }),
    } satisfies PluginV2.HookFunctions
  }),
}
