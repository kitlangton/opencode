import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { OpenAICompatiblePlugin } from "../../../src/v2/plugin/provider/openai-compatible"
import { it, model } from "./provider-helper"

describe("OpenAICompatiblePlugin", () => {
  it.effect("preserves explicit includeUsage false and defaults it to true", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add(OpenAICompatiblePlugin)
      const defaulted = yield* plugin.trigger("aisdk.sdk", { model: model("custom", "model"), package: "@ai-sdk/openai-compatible", options: {} })
      const disabled = yield* plugin.trigger("aisdk.sdk", {
        model: model("custom", "model"),
        package: "@ai-sdk/openai-compatible",
        options: { includeUsage: false },
      })
      expect(defaulted.options.includeUsage).toBe(true)
      expect(disabled.options.includeUsage).toBe(false)
    }),
  )
})
