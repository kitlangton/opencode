import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { GooglePlugin } from "../../../src/v2/plugin/provider/google"
import { it, model } from "./provider-helper"

describe("GooglePlugin", () => {
  it.effect("creates a Google Generative AI SDK for @ai-sdk/google", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add(GooglePlugin)
      const result = yield* plugin.trigger("aisdk.sdk", { model: model("google", "gemini"), package: "@ai-sdk/google", options: {} })
      expect(result.sdk).toBeDefined()
    }),
  )
})
