import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { GithubCopilotPlugin } from "../../../src/v2/plugin/provider/github-copilot"
import { fakeSelectorSdk, it, model } from "./provider-helper"

describe("GithubCopilotPlugin", () => {
  it.effect("selects languageModel when responses and chat are absent", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const calls: string[] = []
      yield* plugin.add(GithubCopilotPlugin)
      yield* plugin.trigger("aisdk.language", {
        model: model("github-copilot", "claude-sonnet-4"),
        sdk: { languageModel: fakeSelectorSdk(calls).languageModel },
        options: {},
      })
      expect(calls).toEqual(["languageModel:claude-sonnet-4"])
    }),
  )

  it.effect("uses responses for gpt-5 models except gpt-5-mini", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const calls: string[] = []
      yield* plugin.add(GithubCopilotPlugin)
      yield* plugin.trigger("aisdk.language", { model: model("github-copilot", "gpt-5"), sdk: fakeSelectorSdk(calls), options: {} })
      yield* plugin.trigger("aisdk.language", { model: model("github-copilot", "gpt-5-mini"), sdk: fakeSelectorSdk(calls), options: {} })
      expect(calls).toEqual(["responses:gpt-5", "chat:gpt-5-mini"])
    }),
  )
})
