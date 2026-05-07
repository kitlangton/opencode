import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { GatewayPlugin } from "../../../src/v2/plugin/provider/gateway"
import { it, model } from "./provider-helper"

describe("GatewayPlugin", () => {
  it.effect("creates a Gateway SDK for @ai-sdk/gateway", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add(GatewayPlugin)
      const result = yield* plugin.trigger("aisdk.sdk", { model: model("gateway", "model"), package: "@ai-sdk/gateway", options: {} })
      expect(result.sdk).toBeDefined()
    }),
  )
})
