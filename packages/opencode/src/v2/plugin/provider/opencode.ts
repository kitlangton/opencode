import { Effect } from "effect"
import { PluginV2 } from "../../plugin"
import { ProviderV2 } from "../../provider"

export const OpencodePlugin = {
  id: PluginV2.ID.make("opencode"),
  definition: Effect.gen(function* () {
    let hasKey = false
    return {
      "provider.update": Effect.fn(function* (evt) {
        if (evt.provider.id !== ProviderV2.ID.opencode) return
        hasKey = Boolean(process.env.OPENCODE_API_KEY || evt.provider.options.aisdk.provider.apiKey)
        if (!hasKey) evt.provider.options.aisdk.provider.apiKey = "public"
      }),
      "model.update": Effect.fn(function* (evt) {
        if (evt.model.providerID !== ProviderV2.ID.opencode) return
        if (hasKey) return
        if (evt.model.cost.some((item) => item.input > 0 || item.output > 0)) evt.cancel = true
      }),
    } satisfies PluginV2.HookFunctions
  }),
}
