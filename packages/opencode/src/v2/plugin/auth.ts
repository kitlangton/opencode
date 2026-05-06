import { Effect } from "effect"
import { AuthV2 } from "../auth"
import { Catalog } from "../catalog"
import { PluginV2 } from "../plugin"

export const AuthPlugin = {
  id: PluginV2.ID.make("auth"),
  definition: Effect.gen(function* () {
    const auth = yield* AuthV2.Service
    const catalog = yield* Catalog.Service

    for (const provider of yield* catalog.provider.all()) {
      const account = yield* auth.active(AuthV2.ServiceID.make(provider.id)).pipe(Effect.orDie)
      if (!account) continue
      yield* catalog.provider.update(provider.id, (draft) => {
        draft.enabled = true
      })
    }

    return {} satisfies PluginV2.HookFunctions
  }),
}
