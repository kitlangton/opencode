import os from "os"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { Effect } from "effect"
import { PluginV2 } from "../../plugin"

export const CloudflareAIGatewayPlugin = PluginV2.define({
  id: PluginV2.ID.make("cloudflare-ai-gateway"),
  effect: Effect.gen(function* () {
    return {
      "aisdk.sdk": Effect.fn(function* (evt) {
        if (evt.package !== "ai-gateway-provider") return
        if (evt.options.baseURL) return
        const { createAiGateway } = yield* Effect.promise(() => import("ai-gateway-provider")).pipe(Effect.orDie)
        const { createUnified } = yield* Effect.promise(() => import("ai-gateway-provider/providers/unified")).pipe(
          Effect.orDie,
        )
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? (typeof evt.options.accountId === "string" ? evt.options.accountId : undefined)
        const gatewayId = process.env.CLOUDFLARE_GATEWAY_ID ?? (typeof evt.options.gateway === "string" ? evt.options.gateway : undefined)
        const apiKey =
          process.env.CLOUDFLARE_API_TOKEN ??
          process.env.CF_AIG_TOKEN ??
          (typeof evt.options.apiKey === "string" ? evt.options.apiKey : undefined)
        if (!accountId || !gatewayId) {
          const missing = [
            !accountId ? "CLOUDFLARE_ACCOUNT_ID" : undefined,
            !gatewayId ? "CLOUDFLARE_GATEWAY_ID" : undefined,
          ].filter((item): item is string => Boolean(item))
          throw new Error(
            `${missing.join(" and ")} missing. Set with: ${missing.map((item) => `export ${item}=<value>`).join(" && ")}`,
          )
        }
        if (!apiKey) {
          throw new Error(
            "CLOUDFLARE_API_TOKEN (or CF_AIG_TOKEN) is required for Cloudflare AI Gateway. Set it via environment variable or run `opencode auth cloudflare-ai-gateway`.",
          )
        }
        const metadata = evt.options.metadata ?? (yield* Effect.try({
          try: () => {
            const headers = evt.options.headers as Record<string, string> | undefined
            if (!headers?.["cf-aig-metadata"]) return undefined
            return JSON.parse(headers["cf-aig-metadata"])
          },
          catch: (error) => error,
        }).pipe(Effect.catch(() => Effect.succeed(undefined))))
        const options = {
          metadata,
          cacheTtl: evt.options.cacheTtl,
          cacheKey: evt.options.cacheKey,
          skipCache: evt.options.skipCache,
          collectLog: evt.options.collectLog,
          headers: {
            "User-Agent": `opencode/${InstallationVersion} cloudflare-ai-gateway (${os.platform()} ${os.release()}; ${os.arch()})`,
          },
        }
        const gateway = createAiGateway({
          accountId,
          gateway: gatewayId,
          apiKey,
          options,
        } as any)
        const unified = createUnified()
        evt.sdk = {
          languageModel(modelID: string) {
            return gateway(unified(modelID))
          },
        }
      }),
    }
  }),
})
