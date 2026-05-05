import { Context, Effect, HashMap, Layer } from "effect"
import { Plugin } from "./plugin"
import { ModelV2 } from "./model"

export * as PluginRuntime from "./plugin-runtime"

type Definition = Plugin.Definition<ModelV2.Service>

export interface Interface {
  readonly add: (input: { id: Plugin.ID; definition: Definition }) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/PluginRuntime") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    let plugins = HashMap.empty<Plugin.ID, Definition>()

    const model = yield* ModelV2.Service
    const plugin = yield* Plugin.Service

    const service = Service.of({
      add: Effect.fn("PluginRuntime.register")(function* (input) {
        plugins = HashMap.set(plugins, input.id, input.definition)
        const hooks = yield* input.definition.pipe(Effect.provideService(ModelV2.Service, model))
        yield* plugin.add({ id: input.id, hooks })
      }),
    })

    return service
  }),
)
