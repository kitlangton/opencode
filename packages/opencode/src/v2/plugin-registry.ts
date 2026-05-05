import { Context, Effect, HashMap, Layer } from "effect"
import { type Plugin } from "./plugin"
import { ModelV2 } from "./model"
import { AuthV2 } from "./auth"

export * as PluginRegistry from "./plugin-registry"

export interface Interface {
  readonly register: (input: { id: Plugin.ID; definition: Plugin.Definition }) => Effect.Effect<void>
  readonly trigger: <Name extends keyof Plugin.Hooks>(
    name: Name,
    input: Parameters<Plugin.Hooks[Name]>[0],
  ) => Effect.Effect<Parameters<Plugin.Hooks[Name]>[0]>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/PluginRegistry") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    let plugins = HashMap.empty<Plugin.ID, Plugin.Definition>()

    const context: Plugin.Context = {
      model: yield* ModelV2.Service,
      auth: yield* AuthV2.Service,
    }

    const result = Service.of({
      register: Effect.fn("PluginRegistry.register")(function* (input) {
        plugins = HashMap.set(plugins, input.id, input.definition)
      }),
      trigger: Effect.fn("PluginRegistry.trigger")(function* (name, input) {
        return input
      }),
    })

    return result
  }),
)
