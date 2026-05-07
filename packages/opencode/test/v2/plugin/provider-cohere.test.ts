import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { CoherePlugin } from "../../../src/v2/plugin/provider/cohere"
import { it, model } from "./provider-helper"

describe("CoherePlugin", () => {
  it.effect("creates a Cohere SDK for @ai-sdk/cohere", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add(CoherePlugin)
      const result = yield* plugin.trigger("aisdk.sdk", { model: model("cohere", "command"), package: "@ai-sdk/cohere", options: {} })
      expect(result.sdk).toBeDefined()
    }),
  )
})
