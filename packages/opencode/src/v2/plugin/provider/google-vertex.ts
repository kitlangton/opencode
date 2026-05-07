import { Effect } from "effect"
import { PluginV2 } from "../../plugin"
import { ProviderV2 } from "../../provider"

export const GoogleVertexPlugin = PluginV2.define({
  id: PluginV2.ID.make("google-vertex"),
  effect: Effect.gen(function* () {
    return {
      "aisdk.sdk": Effect.fn(function* (evt) {
        if (evt.package !== "@ai-sdk/google-vertex") return
        const mod = yield* Effect.promise(() => import("@ai-sdk/google-vertex"))
        const project =
          typeof evt.options.project === "string"
            ? evt.options.project
            : (process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCP_PROJECT ?? process.env.GCLOUD_PROJECT)
        const location =
          typeof evt.options.location === "string"
            ? evt.options.location
            : (process.env.GOOGLE_VERTEX_LOCATION ??
              process.env.GOOGLE_CLOUD_LOCATION ??
              process.env.VERTEX_LOCATION ??
              "us-central1")
        const fetchWithRuntimeOptions = evt.options.fetch
        const customFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
          const { GoogleAuth } = await import("google-auth-library")
          const auth = new GoogleAuth()
          const client = await auth.getApplicationDefault()
          const token = await client.credential.getAccessToken()
          const headers = new Headers(init?.headers)
          headers.set("Authorization", `Bearer ${token.token}`)
          return typeof fetchWithRuntimeOptions === "function"
            ? fetchWithRuntimeOptions(input, { ...init, headers })
            : fetch(input, { ...init, headers })
        }
        evt.sdk = mod.createVertex({
          ...evt.options,
          project,
          location,
          fetch: customFetch as typeof fetch,
        })
      }),
      "aisdk.language": Effect.fn(function* (evt) {
        if (evt.model.providerID !== ProviderV2.ID.googleVertex) return
        evt.language = evt.sdk.languageModel(String(evt.model.apiID).trim())
      }),
    }
  }),
})

export const GoogleVertexAnthropicPlugin = PluginV2.define({
  id: PluginV2.ID.make("google-vertex-anthropic"),
  effect: Effect.gen(function* () {
    return {
      "aisdk.sdk": Effect.fn(function* (evt) {
        if (evt.package !== "@ai-sdk/google-vertex/anthropic") return
        const mod = yield* Effect.promise(() => import("@ai-sdk/google-vertex/anthropic"))
        evt.sdk = mod.createVertexAnthropic({
          ...evt.options,
          project:
            typeof evt.options.project === "string"
              ? evt.options.project
              : (process.env.GOOGLE_CLOUD_PROJECT ?? process.env.GCP_PROJECT ?? process.env.GCLOUD_PROJECT),
          location:
            typeof evt.options.location === "string"
              ? evt.options.location
              : (process.env.GOOGLE_CLOUD_LOCATION ?? process.env.VERTEX_LOCATION ?? "global"),
        })
      }),
      "aisdk.language": Effect.fn(function* (evt) {
        if (evt.model.providerID !== ProviderV2.ID.make("google-vertex-anthropic")) return
        evt.language = evt.sdk.languageModel(String(evt.model.apiID).trim())
      }),
    }
  }),
})
