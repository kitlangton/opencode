import { describe } from "bun:test"
import { Effect } from "effect"
import { ProviderPlugins } from "../../../src/v2/plugin/provider"
import { expectPluginRegistered, it } from "./provider-helper"

describe("LLMGatewayPlugin", () => {
  it.effect("is registered so legacy referer headers can be applied", () =>
    Effect.sync(() => expectPluginRegistered(ProviderPlugins.map((item) => item.id), "llmgateway")),
  )
})
