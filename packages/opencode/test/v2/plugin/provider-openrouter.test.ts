import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { OpenRouterPlugin } from "../../../src/v2/plugin/provider/openrouter"
import { it, provider } from "./provider-helper"

describe("OpenRouterPlugin", () => {
  it.effect("applies legacy referer headers", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add(OpenRouterPlugin)
      const result = yield* plugin.trigger("provider.update", { provider: provider("openrouter"), cancel: false })
      expect(result.provider.options.headers).toEqual({ "HTTP-Referer": "https://opencode.ai/", "X-Title": "opencode" })
    }),
  )
})
