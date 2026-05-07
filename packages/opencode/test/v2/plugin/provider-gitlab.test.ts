import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { PluginV2 } from "../../../src/v2/plugin"
import { GitLabPlugin } from "../../../src/v2/plugin/provider/gitlab"
import { it, model } from "./provider-helper"

describe("GitLabPlugin", () => {
  it.effect("uses workflowChat for duo workflow models and preserves selectedModelRef", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const calls: [string, unknown][] = []
      yield* plugin.add(GitLabPlugin)
      const result = yield* plugin.trigger("aisdk.language", {
        model: model("gitlab", "duo-workflow-custom", {
          options: {
            headers: {},
            body: {},
            aisdk: { provider: {}, request: { workflowRef: "ref", workflowDefinition: "definition", featureFlags: { custom: true } } },
          },
        }),
        sdk: {
          workflowChat: (id: string, options: unknown) => {
            calls.push([id, options])
            return { id, options }
          },
          agenticChat: () => undefined,
        },
        options: {},
      })
      expect(calls).toEqual([["duo-workflow", { featureFlags: { custom: true }, workflowDefinition: "definition" }]])
      expect(result.language as unknown).toEqual({ id: "duo-workflow", options: calls[0]?.[1], selectedModelRef: "ref" })
    }),
  )

  it.effect("uses agenticChat with legacy headers and feature flags for normal models", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const calls: [string, unknown][] = []
      yield* plugin.add(GitLabPlugin)
      yield* plugin.trigger("aisdk.language", {
        model: model("gitlab", "claude", { options: { headers: { h: "v" }, body: {}, aisdk: { provider: {}, request: {} } } }),
        sdk: {
          workflowChat: () => undefined,
          agenticChat: (id: string, options: unknown) => {
            const selected = options as { aiGatewayHeaders?: Record<string, string>; featureFlags?: Record<string, boolean> }
            calls.push([id, { aiGatewayHeaders: { ...selected.aiGatewayHeaders }, featureFlags: { ...selected.featureFlags } }])
          },
        },
        options: { aiGatewayHeaders: { fallback: "header" }, featureFlags: { duo_agent_platform: true } },
      })
      expect(calls).toEqual([["claude", { aiGatewayHeaders: { h: "v" }, featureFlags: { duo_agent_platform: true } }]])
    }),
  )
})
