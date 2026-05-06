import { Effect } from "effect"
import { PluginV2 } from "../../plugin"

export const OpenAICompatiblePlugin = {
  id: PluginV2.ID.make("openai-compatible"),
  definition: Effect.gen(function* () {
    return {
      "aisdk.sdk": Effect.fn(function* (evt) {
        if (evt.package !== "@ai-sdk/openai-compatible") return
        if (evt.options.includeUsage !== false) evt.options.includeUsage = true
        const mod = yield* Effect.promise(() => import("@ai-sdk/openai-compatible"))
        evt.sdk = mod.createOpenAICompatible(evt.options as Parameters<typeof mod.createOpenAICompatible>[0])
      }),
    } satisfies PluginV2.HookFunctions
  }),
}
