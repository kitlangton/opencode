import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { GroqPlugin } from "../../../src/v2/plugin/provider/groq"
import { it, model } from "./provider-helper"

describe("GroqPlugin", () => {
  it.effect("creates a Groq SDK for @ai-sdk/groq", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add(GroqPlugin)
      const result = yield* plugin.trigger("aisdk.sdk", { model: model("groq", "llama"), package: "@ai-sdk/groq", options: {} })
      expect(result.sdk).toBeDefined()
    }),
  )
})
