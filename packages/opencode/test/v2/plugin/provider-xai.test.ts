import { describe, expect } from "bun:test"
import type { LanguageModelV3 } from "@ai-sdk/provider"
import { Effect } from "effect"
import { ModelV2 } from "../../../src/v2/model"
import { PluginV2 } from "../../../src/v2/plugin"
import { XAIPlugin } from "../../../src/v2/plugin/provider/xai"
import { ProviderV2 } from "../../../src/v2/provider"
import { testEffect } from "../../lib/effect"

const it = testEffect(PluginV2.defaultLayer)

const model = new ModelV2.Info({
  ...ModelV2.Info.empty(ProviderV2.ID.make("xai"), ModelV2.ID.make("grok-4")),
  apiID: ModelV2.ID.make("grok-4"),
  endpoint: {
    type: "aisdk",
    package: "@ai-sdk/xai",
  },
})

describe("XAIPlugin", () => {
  it.effect("creates an xAI SDK for @ai-sdk/xai", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add(XAIPlugin)

      const result = yield* plugin.trigger("aisdk.sdk", {
        model,
        package: "@ai-sdk/xai",
        options: {},
      })

      expect(typeof result.sdk?.responses).toBe("function")
    }),
  )

  it.effect("uses responses for xAI language models", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const language = { id: "response-model" } as unknown as LanguageModelV3
      const calls: string[] = []

      yield* plugin.add(XAIPlugin)
      const result = yield* plugin.trigger("aisdk.language", {
        model,
        sdk: {
          responses: (id: string) => {
            calls.push(id)
            return language
          },
        },
        options: {},
      })

      expect(calls).toEqual(["grok-4"])
      expect(result.language).toBe(language)
    }),
  )
})
