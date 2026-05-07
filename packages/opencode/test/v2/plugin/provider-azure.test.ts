import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { AzurePlugin } from "../../../src/v2/plugin/provider/azure"
import { fakeSelectorSdk, it, model, provider, withEnv } from "./provider-helper"

describe("AzurePlugin", () => {
  it.effect("resolves resourceName from env", () =>
    withEnv({ AZURE_RESOURCE_NAME: "from-env" }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        yield* plugin.add(AzurePlugin)
        const result = yield* plugin.trigger("provider.update", { provider: provider("azure"), cancel: false })
        expect(result.provider.options.aisdk.provider.resourceName).toBe("from-env")
      }),
    ),
  )

  it.effect("selects chat only for completion URLs", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const calls: string[] = []
      yield* plugin.add(AzurePlugin)
      yield* plugin.trigger("aisdk.language", {
        model: model("azure", "deployment", { options: { headers: {}, body: {}, aisdk: { provider: {}, request: { useCompletionUrls: true } } } }),
        sdk: fakeSelectorSdk(calls),
        options: {},
      })
      expect(calls).toEqual(["chat:deployment"])
    }),
  )
})
