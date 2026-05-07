import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { CerebrasPlugin } from "../../../src/v2/plugin/provider/cerebras"
import { it, provider } from "./provider-helper"

describe("CerebrasPlugin", () => {
  it.effect("applies the legacy integration header", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add(CerebrasPlugin)
      const result = yield* plugin.trigger("provider.update", { provider: provider("cerebras"), cancel: false })
      expect(result.provider.options.headers).toEqual({ "X-Cerebras-3rd-Party-Integration": "opencode" })
    }),
  )
})
