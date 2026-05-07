import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { CloudflareAIGatewayPlugin } from "../../../src/v2/plugin/provider/cloudflare-ai-gateway"
import { it, model, withEnv } from "./provider-helper"

describe("CloudflareAIGatewayPlugin", () => {
  it.effect("requires account, gateway, and token before creating the unified SDK", () =>
    withEnv(
      { CLOUDFLARE_ACCOUNT_ID: "acct", CLOUDFLARE_GATEWAY_ID: "gateway", CLOUDFLARE_API_TOKEN: "token", CF_AIG_TOKEN: undefined },
      () =>
        Effect.gen(function* () {
          const plugin = yield* PluginV2.Service
          yield* plugin.add(CloudflareAIGatewayPlugin)
          const result = yield* plugin.trigger("aisdk.sdk", {
            model: model("cloudflare-ai-gateway", "openai/gpt-5"),
            package: "ai-gateway-provider",
            options: {},
          })
          expect(result.sdk.languageModel("openai/gpt-5")).toBeDefined()
        }),
    ),
  )
})
