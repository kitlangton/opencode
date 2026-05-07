import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { GoogleVertexPlugin } from "../../../src/v2/plugin/provider/google-vertex"
import { fakeSelectorSdk, it, model } from "./provider-helper"

describe("GoogleVertexPlugin", () => {
  it.effect("trims model IDs before selecting language models", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const calls: string[] = []
      yield* plugin.add(GoogleVertexPlugin)
      yield* plugin.trigger("aisdk.language", {
        model: model("google-vertex", " gemini-2.5-pro "),
        sdk: { languageModel: fakeSelectorSdk(calls).languageModel },
        options: {},
      })
      expect(calls).toEqual(["languageModel:gemini-2.5-pro"])
    }),
  )
})
