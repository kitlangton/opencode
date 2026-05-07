import os from "os"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { Effect } from "effect"
import { PluginV2 } from "../../plugin"
import { ProviderV2 } from "../../provider"

export const CloudflareWorkersAIPlugin = {
  id: PluginV2.ID.make("cloudflare-workers-ai"),
  definition: Effect.gen(function* () {
    return {
      "provider.update": Effect.fn(function* (evt) {
        if (evt.provider.id !== ProviderV2.ID.make("cloudflare-workers-ai")) return
        if (evt.provider.endpoint.type !== "aisdk") return
        const accountId =
          typeof evt.provider.options.aisdk.provider.accountId === "string"
            ? evt.provider.options.aisdk.provider.accountId
            : process.env.CLOUDFLARE_ACCOUNT_ID
        if (accountId) evt.provider.endpoint.url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`
      }),
      "aisdk.sdk": Effect.fn(function* (evt) {
        if (evt.model.providerID !== ProviderV2.ID.make("cloudflare-workers-ai")) return
        if (evt.model.endpoint.type !== "aisdk" || !evt.model.endpoint.url) {
          throw new Error("CLOUDFLARE_ACCOUNT_ID is missing. Set it with: export CLOUDFLARE_ACCOUNT_ID=<your-account-id>")
        }
        const mod = yield* Effect.promise(() => import("@ai-sdk/openai-compatible"))
        evt.sdk = mod.createOpenAICompatible({
          ...evt.options,
          apiKey: evt.options.apiKey ?? process.env.CLOUDFLARE_API_KEY,
          headers: {
            "User-Agent": `opencode/${InstallationVersion} cloudflare-workers-ai (${os.platform()} ${os.release()}; ${os.arch()})`,
            ...evt.options.headers,
          },
          name: "cloudflare-workers-ai",
        } as Parameters<typeof mod.createOpenAICompatible>[0])
      }),
    } satisfies PluginV2.HookFunctions
  }),
}
