import os from "os"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { Effect } from "effect"
import { PluginV2 } from "../../plugin"
import { ProviderV2 } from "../../provider"

export const CloudflareWorkersAIPlugin = {
  id: PluginV2.ID.make("cloudflare-workers-ai"),
  definition: Effect.gen(function* () {
    return {
      "aisdk.sdk": Effect.fn(function* (evt) {
        if (evt.model.providerID !== ProviderV2.ID.make("cloudflare-workers-ai")) return
        const accountId =
          typeof evt.options.accountId === "string"
            ? evt.options.accountId
            : process.env.CLOUDFLARE_ACCOUNT_ID
        const baseURL =
          typeof evt.options.baseURL === "string"
            ? evt.options.baseURL
            : accountId
              ? `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`
              : undefined
        if (!baseURL) {
          throw new Error("CLOUDFLARE_ACCOUNT_ID is missing. Set it with: export CLOUDFLARE_ACCOUNT_ID=<your-account-id>")
        }
        const mod = yield* Effect.promise(() => import("@ai-sdk/openai-compatible"))
        evt.sdk = mod.createOpenAICompatible({
          ...evt.options,
          baseURL,
          apiKey: evt.options.apiKey ?? process.env.CLOUDFLARE_API_KEY,
          headers: {
            "User-Agent": `opencode/${InstallationVersion} cloudflare-workers-ai (${os.platform()} ${os.release()}; ${os.arch()})`,
            ...evt.options.headers,
          },
          name: "cloudflare-workers-ai",
        })
      }),
    } satisfies PluginV2.HookFunctions
  }),
}
