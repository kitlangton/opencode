import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { AmazonBedrockPlugin } from "../../../src/v2/plugin/provider/amazon-bedrock"
import { fakeSelectorSdk, it, model, provider } from "./provider-helper"

describe("AmazonBedrockPlugin", () => {
  it.effect("moves endpoint option to endpoint URL", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add(AmazonBedrockPlugin)
      const result = yield* plugin.trigger("provider.update", {
        provider: provider("amazon-bedrock", {
          options: { headers: {}, body: {}, aisdk: { provider: { endpoint: "https://bedrock.example" }, request: {} } },
        }),
        cancel: false,
      })
      expect(result.provider.endpoint).toEqual({ type: "aisdk", package: "test-provider", url: "https://bedrock.example" })
      expect(result.provider.options.aisdk.provider.endpoint).toBeUndefined()
    }),
  )

  it.effect("applies legacy cross-region inference prefixes", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const calls: string[] = []
      yield* plugin.add(AmazonBedrockPlugin)
      yield* plugin.trigger("aisdk.language", {
        model: model("amazon-bedrock", "anthropic.claude-sonnet-4-5"),
        sdk: { languageModel: fakeSelectorSdk(calls).languageModel },
        options: { region: "eu-west-1" },
      })
      expect(calls).toEqual(["languageModel:eu.anthropic.claude-sonnet-4-5"])
    }),
  )
})
