export * as Plugin from "./plugin"

import { createDraft, finishDraft, type Draft } from "immer"
import { type ModelV2 } from "./model"
import { Context, Effect, HashMap, Layer, Schema } from "effect"
import type { SessionID } from "@/session/schema"
import type { SessionStatus } from "@/session/status"

export const ID = Schema.String.pipe(Schema.brand("Plugin.ID"))
export type ID = typeof ID.Type

export type Hooks = {
  "model.add": {
    readonly source: "env" | "config" | "custom" | "api"
    model: ModelV2.Info
    cancel?: boolean
  }
  "session.status": {
    sessionID: SessionID
    status: SessionStatus.Info
  }
}

type Primitive = string | number | boolean | bigint | symbol | null | undefined

type MutableKeys<T> = {
  [key in keyof T]-?: { [target in key]: T[key] } extends { readonly [target in key]: T[key] } ? never : key
}[keyof T]

type HookInput<T> = {
  readonly [key in keyof T]: key extends MutableKeys<T> ? (T[key] extends Primitive ? T[key] : Draft<T[key]>) : T[key]
}

export type HookFunctions = {
  [key in keyof Hooks]: (input: HookInput<Hooks[key]>) => Effect.Effect<void>
}

export type Definition<R> = Effect.Effect<HookFunctions, never, R>

export interface Interface {
  readonly add: (input: { id: ID; hooks: HookFunctions }) => Effect.Effect<void>
  readonly remove: (id: ID) => Effect.Effect<void>
  readonly trigger: <Name extends keyof Hooks>(name: Name, input: Hooks[Name]) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/Plugin") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    let hooks = HashMap.empty<ID, HookFunctions>()

    const svc = Service.of({
      add: Effect.fn("Plugin.add")(function* (input) {
        hooks = HashMap.set(hooks, input.id, input.hooks)
      }),
      trigger: Effect.fn("Plugin.trigger")(function* (name, input) {
        const draft = createDraft(input)
        for (const hook of HashMap.values(hooks)) {
          const match = hook[name]
          if (!match) continue
          yield* match(draft as any)
        }
        return finishDraft(draft)
      }),
      remove: Effect.fn("Plugin.remove")(function* (id) {
        hooks = HashMap.remove(hooks, id)
      }),
    })
    return svc
  }),
)

export const defaultLayer = layer

// opencode
// sdcok
