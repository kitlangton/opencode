import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { CloudflareWorkersAIPlugin } from "../../../src/v2/plugin/provider/cloudflare-workers-ai"
import { it, model, provider, withEnv } from "./provider-helper"

describe("CloudflareWorkersAIPlugin", () => {
  it.effect("maps account ID to endpoint URL and creates an OpenAI-compatible SDK", () =>
    withEnv({ CLOUDFLARE_ACCOUNT_ID: "acct", CLOUDFLARE_API_KEY: "key" }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        yield* plugin.add(CloudflareWorkersAIPlugin)
        const updated = yield* plugin.trigger("provider.update", { provider: provider("cloudflare-workers-ai"), cancel: false })
        const sdk = yield* plugin.trigger("aisdk.sdk", {
          model: model("cloudflare-workers-ai", "@cf/model", { endpoint: updated.provider.endpoint }),
          package: "@ai-sdk/openai-compatible",
          options: { headers: { custom: "header" } },
        })
        expect(updated.provider.endpoint).toEqual({
          type: "aisdk",
          package: "test-provider",
          url: "https://api.cloudflare.com/client/v4/accounts/acct/ai/v1",
        })
        expect(sdk.sdk).toBeDefined()
      }),
    ),
  )
})
