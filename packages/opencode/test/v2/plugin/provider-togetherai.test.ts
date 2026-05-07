import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { TogetherAIPlugin } from "../../../src/v2/plugin/provider/togetherai"
import { it, model } from "./provider-helper"

describe("TogetherAIPlugin", () => {
  it.effect("creates a TogetherAI SDK for @ai-sdk/togetherai", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add(TogetherAIPlugin)
      const result = yield* plugin.trigger("aisdk.sdk", { model: model("togetherai", "model"), package: "@ai-sdk/togetherai", options: {} })
      expect(result.sdk).toBeDefined()
    }),
  )
})
