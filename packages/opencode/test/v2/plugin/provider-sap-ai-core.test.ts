import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { SapAICorePlugin } from "../../../src/v2/plugin/provider/sap-ai-core"
import { fixtureProvider, it, model, npmLayer, withEnv } from "./provider-helper"

describe("SapAICorePlugin", () => {
  it.effect("loads service key into env, passes deployment options, and calls sdk(modelID)", () =>
    withEnv({ AICORE_SERVICE_KEY: undefined, AICORE_DEPLOYMENT_ID: "deployment", AICORE_RESOURCE_GROUP: "resource-group" }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        yield* plugin.add({ id: SapAICorePlugin.id, effect: SapAICorePlugin.effect.pipe(Effect.provide(npmLayer)) })
        const sdk = yield* plugin.trigger("aisdk.sdk", {
          model: model("sap-ai-core", "sap-model"),
          package: fixtureProvider,
          options: { serviceKey: "service-key" },
        })
        const language = yield* plugin.trigger("aisdk.language", { model: model("sap-ai-core", "sap-model"), sdk: sdk.sdk, options: {} })
        expect(process.env.AICORE_SERVICE_KEY).toBe("service-key")
        expect(sdk.sdk.options).toEqual({ serviceKey: "service-key", deploymentId: "deployment", resourceGroup: "resource-group" })
        expect(language.language as unknown).toEqual({ modelID: "sap-model", options: sdk.sdk.options })
      }),
    ),
  )
})
