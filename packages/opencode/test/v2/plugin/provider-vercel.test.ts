import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { VercelPlugin } from "../../../src/v2/plugin/provider/vercel"
import { it, model, provider } from "./provider-helper"

describe("VercelPlugin", () => {
  it.effect("applies legacy lower-case referer headers", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add(VercelPlugin)
      const result = yield* plugin.trigger("provider.update", {
        provider: provider("vercel", {
          options: { headers: { Existing: "1" }, body: {}, aisdk: { provider: {}, request: {} } },
        }),
        cancel: false,
      })
      expect(result.provider.options.headers).toEqual({
        Existing: "1",
        "http-referer": "https://opencode.ai/",
        "x-title": "opencode",
      })
    }),
  )

  it.effect("does not add legacy upper-case referer headers", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add(VercelPlugin)
      const result = yield* plugin.trigger("provider.update", {
        provider: provider("vercel"),
        cancel: false,
      })
      expect(result.provider.options.headers).not.toHaveProperty("HTTP-Referer")
      expect(result.provider.options.headers).not.toHaveProperty("X-Title")
    }),
  )

  it.effect("uses the model providerID as the @ai-sdk/vercel SDK name", () =>
    Effect.gen(function* () {
      const hooks = yield* VercelPlugin.effect
      const hook = hooks?.["aisdk.sdk"]
      if (!hook) throw new Error("VercelPlugin did not register aisdk.sdk")
      const event: PluginV2.HookInput<"aisdk.sdk"> = {
        model: model("custom-vercel", "v0-1.0-md"),
        package: "@ai-sdk/vercel",
        options: {},
      }
      yield* hook(event)
      expect(event.sdk).toBeDefined()
      expect(event.sdk.languageModel("v0-1.0-md").provider).toBe("custom-vercel.chat")
    }),
  )

  it.effect("ignores non-Vercel providers", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add(VercelPlugin)
      const result = yield* plugin.trigger("provider.update", { provider: provider("gateway"), cancel: false })
      expect(result.provider.options.headers).toEqual({})
    }),
  )
})
