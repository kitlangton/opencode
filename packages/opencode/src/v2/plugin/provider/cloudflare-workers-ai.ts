import os from "os"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { Effect } from "effect"
import { PluginV2 } from "../../plugin"
import { ProviderV2 } from "../../provider"

export const CloudflareWorkersAIPlugin = PluginV2.define({
  id: PluginV2.ID.make("cloudflare-workers-ai"),
  effect: Effect.gen(function* () {
    return {
      "provider.update": Effect.fn(function* (evt) {
        if (evt.provider.id !== ProviderV2.ID.make("cloudflare-workers-ai")) return
        if (evt.provider.endpoint.type !== "aisdk") return
        if (evt.provider.endpoint.url) return
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ??
          (typeof evt.provider.options.aisdk.provider.accountId === "string"
            ? evt.provider.options.aisdk.provider.accountId
            : undefined)
        if (accountId) evt.provider.endpoint.url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`
      }),
      "aisdk.sdk": Effect.fn(function* (evt) {
        if (evt.model.providerID !== ProviderV2.ID.make("cloudflare-workers-ai")) return
        if (evt.package !== "@ai-sdk/openai-compatible") return
        if (evt.model.endpoint.type !== "aisdk" || !evt.model.endpoint.url) {
          throw new Error(
            "CLOUDFLARE_ACCOUNT_ID is missing. Set it with: export CLOUDFLARE_ACCOUNT_ID=<your-account-id>",
          )
        }
        const mod = yield* Effect.promise(() => import("@ai-sdk/openai-compatible"))
        const baseURL = typeof evt.options.baseURL === "string"
          ? evt.options.baseURL.replaceAll("${CLOUDFLARE_ACCOUNT_ID}", process.env.CLOUDFLARE_ACCOUNT_ID ?? "${CLOUDFLARE_ACCOUNT_ID}")
          : evt.options.baseURL
        evt.sdk = mod.createOpenAICompatible({
          ...evt.options,
          baseURL,
          apiKey: process.env.CLOUDFLARE_API_KEY ?? evt.options.apiKey,
          headers: {
            "User-Agent": `opencode/${InstallationVersion} cloudflare-workers-ai (${os.platform()} ${os.release()}; ${os.arch()})`,
            ...evt.options.headers,
          },
          name: "cloudflare-workers-ai",
        } as any)
      }),
      "aisdk.language": Effect.fn(function* (evt) {
        if (evt.model.providerID !== ProviderV2.ID.make("cloudflare-workers-ai")) return
        evt.language = evt.sdk.languageModel(evt.model.apiID)
      }),
    }
  }),
})
