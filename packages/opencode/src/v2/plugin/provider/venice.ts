import { Effect } from "effect"
import { PluginV2 } from "../../plugin"

export const VenicePlugin = {
  id: PluginV2.ID.make("venice"),
  definition: Effect.gen(function* () {
    return {
      "aisdk.sdk": Effect.fn(function* (evt) {
        if (evt.package !== "venice-ai-sdk-provider") return
        const mod = yield* Effect.promise(() => import("venice-ai-sdk-provider"))
        evt.sdk = mod.createVenice(evt.options)
      }),
    } satisfies PluginV2.HookFunctions
  }),
}
