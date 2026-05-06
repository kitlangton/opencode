import { EOL } from "os"
import { Effect, Layer } from "effect"
import { AuthV2 } from "@/v2/auth"
import { Catalog } from "@/v2/catalog"
import { PluginV2 } from "@/v2/plugin"
import { PluginRuntime } from "@/v2/plugin-runtime"
import { AuthPlugin } from "@/v2/plugin/auth"
import { EnvPlugin } from "@/v2/plugin/env"
import { ModelsDevPlugin } from "@/v2/plugin/models-dev"
import { ProviderPlugins } from "@/v2/plugin/provider"
import { Npm } from "@opencode-ai/core/npm"
import { Config } from "@/config/config"
import { effectCmd } from "../../effect-cmd"

const layer = PluginRuntime.layer.pipe(
  Layer.provideMerge(Catalog.layer),
  Layer.provideMerge(PluginV2.defaultLayer),
  Layer.provideMerge(AuthV2.defaultLayer),
  Layer.provideMerge(Npm.defaultLayer),
  Layer.provideMerge(Config.defaultLayer),
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

      return {
        providers: yield* catalog.provider.available(),
      }
    }).pipe(Effect.provide(layer), Effect.orDie)

    process.stdout.write(JSON.stringify(result, null, 2) + EOL)
  }),
})
