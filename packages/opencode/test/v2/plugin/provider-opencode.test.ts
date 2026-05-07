import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { OpencodePlugin } from "../../../src/v2/plugin/provider/opencode"
import { it, model, provider, withEnv } from "./provider-helper"

describe("OpencodePlugin", () => {
  it.effect("uses a public key and cancels paid models without credentials", () =>
    withEnv({ OPENCODE_API_KEY: undefined }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        yield* plugin.add(OpencodePlugin)
        const updated = yield* plugin.trigger("provider.update", { provider: provider("opencode"), cancel: false })
        const paid = yield* plugin.trigger("model.update", {
          model: model("opencode", "paid", { cost: [{ input: 1, output: 0, cache: { read: 0, write: 0 } }] }),
          cancel: false,
        })
        expect(updated.provider.options.aisdk.provider.apiKey).toBe("public")
        expect(paid.cancel).toBe(true)
      }),
    ),
  )
})
