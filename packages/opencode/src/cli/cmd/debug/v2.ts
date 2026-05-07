import { EOL } from "os"
import { Effect, Layer, Option } from "effect"
import { AuthV2 } from "@/v2/auth"
import { Catalog } from "@/v2/catalog"
import { PluginV2 } from "@/v2/plugin"
import { PluginRuntime } from "@/v2/plugin-runtime"
import { AuthPlugin } from "@/v2/plugin/auth"
import { EnvPlugin } from "@/v2/plugin/env"
import { ModelsDevPlugin } from "@/v2/plugin/models-dev"
import { ProviderPlugins } from "@/v2/plugin/provider"
import { Npm } from "@opencode-ai/core/npm"
import { effectCmd } from "../../effect-cmd"

const layer = PluginRuntime.layer.pipe(
  Layer.provideMerge(Catalog.layer),
  Layer.provideMerge(PluginV2.defaultLayer),
  Layer.provideMerge(AuthV2.defaultLayer),
  Layer.provideMerge(Npm.defaultLayer),
)

export const V2Command = effectCmd({
  command: "v2",
  describe: "debug v2 catalog and built-in plugins",
  instance: false,
  handler: Effect.fn("Cli.debug.v2")(function* () {
    const result = yield* Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const plugin = yield* PluginRuntime.Service

      // providers
      for (const item of ProviderPlugins) {
        yield* plugin.add(item)
      }
      yield* plugin.add(EnvPlugin)
      yield* plugin.add(AuthPlugin)
      // load models
      yield* plugin.add(ModelsDevPlugin)

      const providers = (yield* catalog.provider.available()).sort((a, b) => a.id.localeCompare(b.id))
      const all = (yield* catalog.provider.all()).sort((a, b) => a.id.localeCompare(b.id))
      return {
        providers,
        default: Option.getOrUndefined(Option.map(yield* catalog.model.default(), (model) => model.id)),
        small: Object.fromEntries(
          yield* Effect.all(
            all.map((provider) =>
              Effect.map(catalog.model.small(provider.id), (model) =>
                [provider.id, Option.getOrUndefined(Option.map(model, (item) => item.id))] as const,
              ),
            ),
            { concurrency: "unbounded" },
          ),
        ),
      }
    }).pipe(Effect.provide(layer), Effect.orDie)

    process.stdout.write(JSON.stringify(result, null, 2) + EOL)
  }),
})
