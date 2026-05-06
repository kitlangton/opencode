export * as PluginV2 from "./plugin"

import { createDraft, finishDraft, type Draft } from "immer"
import { type ModelV2 } from "./model"
import { type ProviderV2 } from "./provider"
import { Context, Effect, Layer, Schema } from "effect"
import type { SessionID } from "@/session/schema"
import type { SessionStatus } from "@/session/status"

export const ID = Schema.String.pipe(Schema.brand("Plugin.ID"))
export type ID = typeof ID.Type

export type Hooks = {
  "provider.update": {
    provider: Draft<ProviderV2.Info>
    cancel: boolean
  }
  "model.update": {
    model: Draft<ModelV2.Info>
    cancel: boolean
  }
  "session.status": {
    sessionID: SessionID
    status: SessionStatus.Info
  }
}

export type HookFunctions = {
  [key in keyof Hooks]?: (input: Hooks[key]) => Effect.Effect<void>
}

export type HookInput<Name extends keyof Hooks> = {
  [Field in keyof Hooks[Name]]: Hooks[Name][Field] extends Draft<infer T> ? T : Hooks[Name][Field]
}

export type Definition<R = never> = Effect.Effect<HookFunctions | void, never, R>

type Registered = {
  id: ID
  hooks: HookFunctions
}

export interface Interface {
  readonly add: (input: { id: ID; hooks: HookFunctions }) => Effect.Effect<void>
  readonly remove: (id: ID) => Effect.Effect<void>
  readonly trigger: <Name extends keyof Hooks>(name: Name, input: HookInput<Name>) => Effect.Effect<HookInput<Name>>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/Plugin") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    let hooks: Registered[] = []

    const svc = Service.of({
      add: Effect.fn("Plugin.add")(function* (input) {
        hooks = [...hooks.filter((item) => item.id !== input.id), input]
      }),
      trigger: Effect.fn("Plugin.trigger")(function* (name, input) {
        const draft = createDraft(input)
        for (const item of hooks) {
          const match = item.hooks[name]
          if (!match) continue
          yield* match(draft as any)
        }
        const result = finishDraft(draft)
        return result as any
      }),
      remove: Effect.fn("Plugin.remove")(function* (id) {
        hooks = hooks.filter((item) => item.id !== id)
      }),
    })
    return svc
  }),
)

export const defaultLayer = layer

// opencode
// sdcok
