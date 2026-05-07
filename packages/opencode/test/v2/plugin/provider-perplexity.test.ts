import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { ModelV2 } from "../../../src/v2/model"
import { PluginV2 } from "../../../src/v2/plugin"
import { PerplexityPlugin } from "../../../src/v2/plugin/provider/perplexity"
import { fakeSelectorSdk, it, model } from "./provider-helper"

describe("PerplexityPlugin", () => {
  it.effect("creates a Perplexity SDK for the exact @ai-sdk/perplexity package", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add(PerplexityPlugin)
      const result = yield* plugin.trigger("aisdk.sdk", { model: model("perplexity", "sonar"), package: "@ai-sdk/perplexity", options: {} })
      expect(result.sdk).toBeDefined()
    }),
  )

  it.effect("ignores packages that are not the bundled Perplexity package", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add(PerplexityPlugin)
      const result = yield* plugin.trigger("aisdk.sdk", {
        model: model("perplexity", "sonar"),
        package: "@ai-sdk/perplexity-compatible",
        options: {},
      })
      expect(result.sdk).toBeUndefined()
    }),
  )

  it.effect("uses the Perplexity provider ID as the SDK name for the bundled provider", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const providers: string[] = []
      yield* plugin.add(PerplexityPlugin)
      yield* plugin.add({
        id: PluginV2.ID.make("perplexity-sdk-inspector"),
        effect: Effect.succeed({
          "aisdk.sdk": (evt) =>
            Effect.sync(() => {
              providers.push(evt.sdk.languageModel("sonar").provider)
            }),
        }),
      })
      yield* plugin.trigger("aisdk.sdk", {
        model: model("perplexity", "sonar"),
        package: "@ai-sdk/perplexity",
        options: {},
      })
      expect(providers).toEqual(["perplexity"])
    }),
  )

  it.effect("uses the model provider ID as the SDK name for bundled Perplexity SDKs", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const providers: string[] = []
      yield* plugin.add(PerplexityPlugin)
      yield* plugin.add({
        id: PluginV2.ID.make("custom-perplexity-sdk-inspector"),
        effect: Effect.succeed({
          "aisdk.sdk": (evt) =>
            Effect.sync(() => {
              providers.push(evt.sdk.languageModel("sonar").provider)
            }),
        }),
      })
      yield* plugin.trigger("aisdk.sdk", {
        model: model("custom-perplexity", "sonar"),
        package: "@ai-sdk/perplexity",
        options: {},
      })
      expect(providers).toEqual(["custom-perplexity"])
    }),
  )

  it.effect("leaves Perplexity language selection to the default languageModel fallback", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const calls: string[] = []
      yield* plugin.add(PerplexityPlugin)
      const result = yield* plugin.trigger("aisdk.language", {
        model: model("perplexity", "alias", { apiID: ModelV2.ID.make("sonar") }),
        sdk: fakeSelectorSdk(calls),
        options: {},
      })
      expect(calls).toEqual([])
      expect(result.language).toBeUndefined()
    }),
  )
})
