import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { AnthropicPlugin } from "../../../src/v2/plugin/provider/anthropic"
import { it, provider } from "./provider-helper"

describe("AnthropicPlugin", () => {
  it.effect("applies legacy beta headers", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add(AnthropicPlugin)
      const result = yield* plugin.trigger("provider.update", { provider: provider("anthropic"), cancel: false })
      expect(result.provider.options.headers["anthropic-beta"]).toBe(
        "interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14",
      )
    }),
  )
})
