import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { PerplexityPlugin } from "../../../src/v2/plugin/provider/perplexity"
import { it, model } from "./provider-helper"

describe("PerplexityPlugin", () => {
  it.effect("creates a Perplexity SDK for @ai-sdk/perplexity", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add(PerplexityPlugin)
      const result = yield* plugin.trigger("aisdk.sdk", { model: model("perplexity", "sonar"), package: "@ai-sdk/perplexity", options: {} })
      expect(result.sdk).toBeDefined()
    }),
  )
})
