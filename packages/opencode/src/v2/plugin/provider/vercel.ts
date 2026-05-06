import { Effect } from "effect"
import { PluginV2 } from "../../plugin"

export const VercelPlugin = {
  id: PluginV2.ID.make("vercel"),
  definition: Effect.gen(function* () {
    return {
      "aisdk.sdk": Effect.fn(function* (evt) {
        if (evt.package !== "@ai-sdk/vercel") return
        const mod = yield* Effect.promise(() => import("@ai-sdk/vercel"))
        evt.sdk = mod.createVercel(evt.options)
      }),
    } satisfies PluginV2.HookFunctions
  }),
}
