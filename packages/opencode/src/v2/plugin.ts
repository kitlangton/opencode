export * as Plugin from "./plugin"

import { ModelV2 } from "./model"
import type { AuthV2 } from "./auth"
import { Effect, Schema } from "effect"
import type { Draft } from "immer"

export const ID = Schema.String.pipe(Schema.brand("Plugin.ID"))
export type ID = typeof ID.Type

export type Context = {
  model: ModelV2.Interface
  auth: AuthV2.Interface
}

export type Hooks = {
  "model.add": (input: { readonly id: ModelV2.ID; model: Draft<ModelV2.Info> }) => Effect.Effect<void>
}

export type Definition = (context: Context) => Effect.Effect<Hooks>
