import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { VenicePlugin } from "../../../src/v2/plugin/provider/venice"
import { it, model } from "./provider-helper"

describe("VenicePlugin", () => {
  it.effect("creates a Venice SDK for venice-ai-sdk-provider", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add(VenicePlugin)
      const result = yield* plugin.trigger("aisdk.sdk", { model: model("venice", "model"), package: "venice-ai-sdk-provider", options: {} })
      expect(result.sdk).toBeDefined()
    }),
  )
})
