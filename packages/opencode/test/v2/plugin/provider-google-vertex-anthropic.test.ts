import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { GoogleVertexAnthropicPlugin } from "../../../src/v2/plugin/provider/google-vertex"
import { fakeSelectorSdk, it, model } from "./provider-helper"

describe("GoogleVertexAnthropicPlugin", () => {
  it.effect("trims model IDs before selecting language models", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const calls: string[] = []
      yield* plugin.add(GoogleVertexAnthropicPlugin)
      yield* plugin.trigger("aisdk.language", {
        model: model("google-vertex-anthropic", " claude-sonnet-4-5 "),
        sdk: { languageModel: fakeSelectorSdk(calls).languageModel },
        options: {},
      })
      expect(calls).toEqual(["languageModel:claude-sonnet-4-5"])
    }),
  )
})
