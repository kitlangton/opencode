import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { Catalog } from "../../../src/v2/catalog"
import { PluginV2 } from "../../../src/v2/plugin"
import { ProviderPlugins } from "../../../src/v2/plugin/provider"
import { NvidiaPlugin } from "../../../src/v2/plugin/provider/nvidia"
import { ProviderV2 } from "../../../src/v2/provider"
import { expectPluginRegistered, it, provider } from "./provider-helper"

describe("NvidiaPlugin", () => {
  it.effect("is registered so legacy referer headers can be applied", () =>
    Effect.sync(() => expectPluginRegistered(ProviderPlugins.map((item) => item.id), "nvidia")),
  )

  it.effect("applies legacy referer headers only to nvidia", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      yield* plugin.add(NvidiaPlugin)
      const result = yield* plugin.trigger("provider.update", {
        provider: provider("nvidia", {
          options: { headers: { Existing: "value" }, body: {}, aisdk: { provider: {}, request: {} } },
        }),
        cancel: false,
      })
      const ignored = yield* plugin.trigger("provider.update", { provider: provider("openrouter"), cancel: false })
      expect(result.provider.options.headers).toEqual({
        Existing: "value",
        "HTTP-Referer": "https://opencode.ai/",
        "X-Title": "opencode",
      })
      expect(ignored.provider.options.headers).toEqual({})
    }),
  )

  it.effect("does not decorate nvidia when the provider is only an empty catalog placeholder", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const catalog = yield* Catalog.Service
      yield* plugin.add(NvidiaPlugin)

      yield* catalog.provider.update(ProviderV2.ID.make("nvidia"), () => {})

      const result = yield* catalog.provider.get(ProviderV2.ID.make("nvidia"))
      expect(result.options.headers).toEqual({})
    }).pipe(Effect.provide(Catalog.layer)),
  )

  it.effect("decorates nvidia when the provider already exists", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const catalog = yield* Catalog.Service
      yield* plugin.add(NvidiaPlugin)

      yield* catalog.provider.update(ProviderV2.ID.make("nvidia"), (provider) => {
        provider.enabled = { via: "custom", data: {} }
        provider.options.headers.Existing = "value"
      })

      const result = yield* catalog.provider.get(ProviderV2.ID.make("nvidia"))
      expect(result.options.headers).toEqual({
        Existing: "value",
        "HTTP-Referer": "https://opencode.ai/",
        "X-Title": "opencode",
      })
    }).pipe(Effect.provide(Catalog.layer)),
  )
})
