import { Effect } from "effect"
import { AuthV2 } from "../auth"
import { PluginV2 } from "../plugin"

export const AuthPlugin = {
  id: PluginV2.ID.make("auth"),
  definition: Effect.gen(function* () {
    const auth = yield* AuthV2.Service
    return {
      "provider.update": Effect.fn(function* (evt) {
        const account = yield* auth.active(AuthV2.ServiceID.make(evt.provider.id)).pipe(Effect.orDie)
        if (!account) return
        evt.provider.enabled = {
          via: "auth",
          service: account.serviceID,
        }
      }),
    } satisfies PluginV2.HookFunctions
  }),
}
