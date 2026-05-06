import { Effect } from "effect"
import { PluginV2 } from "../../plugin"

export const CloudflareAIGatewayPlugin = {
  id: PluginV2.ID.make("cloudflare-ai-gateway"),
  definition: Effect.gen(function* () {
    return {
      "aisdk.sdk": Effect.fn(function* (evt) {
        if (evt.package !== "ai-gateway-provider") return
        const { createAiGateway } = yield* Effect.promise(() => import("ai-gateway-provider")).pipe(Effect.orDie)
        const { createUnified } = yield* Effect.promise(() => import("ai-gateway-provider/providers/unified")).pipe(
          Effect.orDie,
        )
        const accountId =
          typeof evt.options.accountId === "string"
            ? evt.options.accountId
            : process.env.CLOUDFLARE_ACCOUNT_ID
        const gatewayId =
          typeof evt.options.gateway === "string"
            ? evt.options.gateway
            : process.env.CLOUDFLARE_GATEWAY_ID
        const apiKey =
          typeof evt.options.apiKey === "string"
            ? evt.options.apiKey
            : (process.env.CLOUDFLARE_API_TOKEN ?? process.env.CF_AIG_TOKEN)
        if (!accountId) throw new Error("CLOUDFLARE_ACCOUNT_ID missing. Set with: export CLOUDFLARE_ACCOUNT_ID=<value>")
        if (!gatewayId) throw new Error("CLOUDFLARE_GATEWAY_ID missing. Set with: export CLOUDFLARE_GATEWAY_ID=<value>")
        if (!apiKey) {
          throw new Error(
            "CLOUDFLARE_API_TOKEN (or CF_AIG_TOKEN) is required for Cloudflare AI Gateway. Set it via environment variable.",
          )
        }
        const gateway = createAiGateway({
          ...evt.options,
          accountId,
          gateway: gatewayId,
          apiKey,
        } as Parameters<typeof createAiGateway>[0])
        const unified = createUnified()
        evt.sdk = {
          languageModel(modelID: string) {
            return gateway(unified(modelID))
          },
        }
      }),
    } satisfies PluginV2.HookFunctions
  }),
}
