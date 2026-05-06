import { Effect } from "effect"
import { PluginV2 } from "../../plugin"

export const GroqPlugin = {
  id: PluginV2.ID.make("groq"),
  definition: Effect.gen(function* () {
    return {
      "aisdk.sdk": Effect.fn(function* (evt) {
        if (evt.package !== "@ai-sdk/groq") return
        const mod = yield* Effect.promise(() => import("@ai-sdk/groq"))
        evt.sdk = mod.createGroq(evt.options)
      }),
    } satisfies PluginV2.HookFunctions
  }),
}
