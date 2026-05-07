import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { OpenAIPlugin } from "../../../src/v2/plugin/provider/openai"
import { fakeSelectorSdk, it, model } from "./provider-helper"

describe("OpenAIPlugin", () => {
  it.effect("uses the Responses API for language models", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const calls: string[] = []
      yield* plugin.add(OpenAIPlugin)
      const result = yield* plugin.trigger("aisdk.language", { model: model("openai", "gpt-5"), sdk: fakeSelectorSdk(calls), options: {} })
      expect(calls).toEqual(["responses:gpt-5"])
      expect(result.language).toBeDefined()
    }),
  )
})
