import { Context, Effect, Layer } from "effect"
import { PluginV2 } from "./plugin"
import { AuthV2 } from "./auth"
import { Catalog } from "./catalog"
import { Npm } from "@opencode-ai/core/npm"

export * as PluginRuntime from "./plugin-runtime"

export type Effect = Effect.Effect<PluginV2.HookFunctions | void, never, Catalog.Service | AuthV2.Service | Npm.Service>

export interface Interface {
  readonly add: (input: { id: PluginV2.ID; effect: Effect }) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/PluginRuntime") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const catalog = yield* Catalog.Service
    const plugin = yield* PluginV2.Service
    const auth = yield* AuthV2.Service
    const npm = yield* Npm.Service

    const add = Effect.fn("PluginRuntime.register")(function* (input) {
      yield* plugin.add({
        id: input.id,
        effect: input.effect.pipe(
          Effect.provideService(Catalog.Service, catalog),
          Effect.provideService(AuthV2.Service, auth),
          Effect.provideService(Npm.Service, npm),
        ),
      })
    })

    const service = Service.of({
      add,
    })

    return service
  }),
)

export const defaultLayer = layer.pipe(
  Layer.provide(Catalog.defaultLayer),
  Layer.provide(PluginV2.defaultLayer),
  Layer.provide(AuthV2.defaultLayer),
)
