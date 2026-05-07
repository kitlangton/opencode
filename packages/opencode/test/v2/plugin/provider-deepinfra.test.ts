import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { DeepInfraPlugin } from "../../../src/v2/plugin/provider/deepinfra"
import { it, model } from "./provider-helper"

describe("DeepInfraPlugin", () => {
  it.effect("creates a DeepInfra SDK for @ai-sdk/deepinfra", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add(DeepInfraPlugin)
      const result = yield* plugin.trigger("aisdk.sdk", { model: model("deepinfra", "model"), package: "@ai-sdk/deepinfra", options: {} })
      expect(result.sdk).toBeDefined()
    }),
  )
})
