import { Context, Effect, Layer } from "effect"
import { PluginV2 } from "./plugin"
import { AuthV2 } from "./auth"
import { Catalog } from "./catalog"

export * as PluginRuntime from "./plugin-runtime"

type Definition<R = never> = PluginV2.Definition<Catalog.Service | AuthV2.Service | R>

export interface Interface {
  readonly add: <R = never>(input: { id: PluginV2.ID; definition: Definition<R> }) => Effect.Effect<void, never, R>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/PluginRuntime") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const catalog = yield* Catalog.Service
    const plugin = yield* PluginV2.Service
    const auth = yield* AuthV2.Service

    const add = Effect.fn("PluginRuntime.register")(function* <R>(input: {
      id: PluginV2.ID
      definition: Definition<R>
    }) {
      const hooks = yield* input.definition.pipe(
        Effect.provideService(Catalog.Service, catalog),
        Effect.provideService(AuthV2.Service, auth),
      )
      yield* plugin.add({ id: input.id, hooks: hooks ?? {} })
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
