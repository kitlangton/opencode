import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { MistralPlugin } from "../../../src/v2/plugin/provider/mistral"
import { it, model } from "./provider-helper"

describe("MistralPlugin", () => {
  it.effect("creates a Mistral SDK for @ai-sdk/mistral", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add(MistralPlugin)
      const result = yield* plugin.trigger("aisdk.sdk", { model: model("mistral", "mistral-large"), package: "@ai-sdk/mistral", options: {} })
      expect(result.sdk).toBeDefined()
    }),
  )
})
