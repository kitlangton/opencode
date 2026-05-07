export * as PluginV2 from "./plugin"

import { createDraft, finishDraft, type Draft } from "immer"
import type { LanguageModelV3 } from "@ai-sdk/provider"
import { type ModelV2 } from "./model"
import { type ProviderV2 } from "./provider"
import { Context, Effect, Layer, Schema } from "effect"

export const ID = Schema.String.pipe(Schema.brand("Plugin.ID"))
export type ID = typeof ID.Type

type HookSpec = {
  "provider.update": {
    input: {}
    output: {
      provider: ProviderV2.Info
      cancel: boolean
    }
  }
  "model.update": {
    input: {}
    output: {
      model: ModelV2.Info
      cancel: boolean
    }
  }
  "aisdk.language": {
    input: {
      model: ModelV2.Info
      sdk: any
      options: Record<string, any>
    }
    output: {
      language?: LanguageModelV3
    }
  }
  "aisdk.sdk": {
    input: {
      model: ModelV2.Info
      package: string
      options: Record<string, any>
    }
    output: {
      sdk?: any
    }
  }
}

export type Hooks = {
  [Name in keyof HookSpec]: Readonly<HookSpec[Name]["input"]> & {
    -readonly [Field in keyof HookSpec[Name]["output"]]: HookSpec[Name]["output"][Field] extends object
      ? Draft<HookSpec[Name]["output"][Field]>
      : HookSpec[Name]["output"][Field]
  }
}

export type HookFunctions = {
  [key in keyof Hooks]?: (input: Hooks[key]) => Effect.Effect<void>
}

export type HookInput<Name extends keyof Hooks> = {
  [Field in keyof (HookSpec[Name]["input"] & HookSpec[Name]["output"])]:(HookSpec[Name]["input"] &
    HookSpec[Name]["output"])[Field]
}

export type Effect = Effect.Effect<HookFunctions | void, never, never>

const HookOutputFields = {
  "provider.update": ["provider", "cancel"],
  "model.update": ["model", "cancel"],
  "aisdk.language": ["language"],
  "aisdk.sdk": ["sdk"],
} as const satisfies { [Name in keyof HookSpec]: readonly (keyof HookSpec[Name]["output"])[] }

function cloneValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneValue)
  if (!value || typeof value !== "object") return value
  if (value instanceof Headers) return new Headers(value)
  if (value instanceof URL) return new URL(value)
  if (value instanceof Request) return value.clone()
  if (value instanceof Response) return value.clone()
  if (Object.getPrototypeOf(value) !== Object.prototype) return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]))
}

function cloneInput<Name extends keyof Hooks>(input: HookInput<Name>) {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, cloneValue(value)])) as HookInput<Name>
}

function normalize<Name extends keyof Hooks>(name: Name, event: Record<string, unknown>) {
  if (name !== "aisdk.sdk") return event
  const model = event.model as ModelV2.Info
  const options = event.options && typeof event.options === "object" ? (event.options as Record<string, unknown>) : {}
  event.options = {
    name: model.providerID,
    ...options,
  }
  return event
}

export function define<R>(input: { id: ID; effect: Effect.Effect<HookFunctions | void, never, R> }) {
  return input
}

export interface Interface {
  readonly add: (input: { id: ID; effect: Effect }) => Effect.Effect<void>
  readonly remove: (id: ID) => Effect.Effect<void>
  readonly trigger: <Name extends keyof Hooks>(name: Name, input: HookInput<Name>) => Effect.Effect<HookInput<Name>>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/Plugin") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    let hooks: {
      id: ID
      hooks: HookFunctions
    }[] = []

    const svc = Service.of({
      add: Effect.fn("Plugin.add")(function* (input) {
        const result = yield* input.effect
        if (!result) return
        hooks = [
          ...hooks.filter((item) => item.id !== input.id),
          {
            id: input.id,
            hooks: result,
          },
        ]
      }),
      trigger: Effect.fn("Plugin.trigger")(function* (name, input) {
        const outputFields = HookOutputFields[name]
        const draftEntries = new Map<string, ReturnType<typeof createDraft>>()
        const event = normalize(name, cloneInput(input) as Record<string, unknown>)

        for (const field of outputFields) {
          if (!(field in input)) continue
          const value = (input as Record<string, unknown>)[String(field)]
          if (value && typeof value === "object") {
            draftEntries.set(String(field), createDraft(value))
            event[String(field)] = draftEntries.get(String(field))
          }
        }

        for (const item of hooks) {
          const match = item.hooks[name]
          if (!match) continue
          yield* match(event as any).pipe(
            Effect.withSpan(`Plugin.hook.${name}`, {
              attributes: {
                plugin: item.id,
                hook: name,
              },
            }),
          )
        }

        for (const [field, draft] of draftEntries) {
          event[field] = finishDraft(draft)
        }

        return event as any
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
