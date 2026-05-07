import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { VercelPlugin } from "../../../src/v2/plugin/provider/vercel"
import { it, provider } from "./provider-helper"

describe("VercelPlugin", () => {
  it.effect("applies legacy lower-case referer headers", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add(VercelPlugin)
      const result = yield* plugin.trigger("provider.update", { provider: provider("vercel"), cancel: false })
      expect(result.provider.options.headers).toEqual({ "http-referer": "https://opencode.ai/", "x-title": "opencode" })
    }),
  )
})
