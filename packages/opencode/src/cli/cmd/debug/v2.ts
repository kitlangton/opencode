import { EOL } from "os"
import { Effect, Layer } from "effect"
import { AuthV2 } from "@/v2/auth"
import { Catalog } from "@/v2/catalog"
import { PluginV2 } from "@/v2/plugin"
import { PluginRuntime } from "@/v2/plugin-runtime"
import { EnvPlugin } from "@/v2/plugin/env"
import { ModelsDevPlugin } from "@/v2/plugin/models-dev"
import { OpenRouterPlugin } from "@/v2/plugin/openrouter"
import { effectCmd } from "../../effect-cmd"

const layer = PluginRuntime.layer.pipe(
  Layer.provideMerge(Catalog.layer),
  Layer.provideMerge(PluginV2.defaultLayer),
  Layer.provideMerge(AuthV2.defaultLayer),
)

export const V2Command = effectCmd({
  command: "v2",
  describe: "debug v2 catalog and built-in plugins",
  instance: false,
  handler: Effect.fn("Cli.debug.v2")(function* () {
    const result = yield* Effect.gen(function* () {
      const catalog = yield* Catalog.Service
      const plugin = yield* PluginRuntime.Service

      yield* plugin.add(OpenRouterPlugin)
      yield* plugin.add(ModelsDevPlugin)
      yield* plugin.add(EnvPlugin)

      return {
        providers: yield* catalog.provider.available(),
        models: yield* catalog.model.available(),
      }
    }).pipe(Effect.provide(layer), Effect.orDie)

    process.stdout.write(JSON.stringify(result, null, 2) + EOL)
  }),
})
