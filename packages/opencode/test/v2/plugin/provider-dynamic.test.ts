import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { DynamicProviderPlugin } from "../../../src/v2/plugin/provider/dynamic"
import { fixtureProvider, it, model, npmLayer } from "./provider-helper"

describe("DynamicProviderPlugin", () => {
  it.effect("creates an SDK from a provider factory export", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add({ id: DynamicProviderPlugin.id, effect: DynamicProviderPlugin.effect.pipe(Effect.provide(npmLayer)) })
      const result = yield* plugin.trigger("aisdk.sdk", {
        model: model("custom", "test-model"),
        package: fixtureProvider,
        options: { marker: "dynamic" },
      })
      expect(result.sdk.options).toEqual({ marker: "dynamic" })
      expect(result.sdk.languageModel("x")).toEqual({ modelID: "x", options: { marker: "dynamic" } })
    }),
  )
})
