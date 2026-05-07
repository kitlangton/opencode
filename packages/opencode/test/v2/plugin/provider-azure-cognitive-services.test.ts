import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { AzureCognitiveServicesPlugin } from "../../../src/v2/plugin/provider/azure"
import { it, provider, withEnv } from "./provider-helper"

describe("AzureCognitiveServicesPlugin", () => {
  it.effect("maps the resource env var to the Azure OpenAI base URL", () =>
    withEnv({ AZURE_COGNITIVE_SERVICES_RESOURCE_NAME: "cognitive" }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        yield* plugin.add(AzureCognitiveServicesPlugin)
        const result = yield* plugin.trigger("provider.update", {
          provider: provider("azure-cognitive-services"),
          cancel: false,
        })
        expect(result.provider.endpoint).toEqual({
          type: "aisdk",
          package: "test-provider",
          url: "https://cognitive.cognitiveservices.azure.com/openai",
        })
      }),
    ),
  )
})
