import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { AlibabaPlugin } from "../../../src/v2/plugin/provider/alibaba"
import { it, model } from "./provider-helper"

describe("AlibabaPlugin", () => {
  it.effect("creates an Alibaba SDK for @ai-sdk/alibaba", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add(AlibabaPlugin)
      const result = yield* plugin.trigger("aisdk.sdk", { model: model("alibaba", "qwen"), package: "@ai-sdk/alibaba", options: {} })
      expect(result.sdk).toBeDefined()
    }),
  )
})
