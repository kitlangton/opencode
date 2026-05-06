import { Effect } from "effect"
import { Catalog } from "../catalog"
import { PluginV2 } from "../plugin"

export const EnvPlugin = {
  id: PluginV2.ID.make("env"),
  definition: Effect.gen(function* () {
    const catalog = yield* Catalog.Service

    for (const provider of yield* catalog.provider.all()) {
      const key = provider.env.find((item) => process.env[item])
      if (!key) continue
      yield* catalog.provider.update(provider.id, (draft) => {
        draft.enabled = true
        draft.options.body["apiKey"] = process.env[key]
      })
    }

    return {} satisfies PluginV2.HookFunctions
  }),
}
