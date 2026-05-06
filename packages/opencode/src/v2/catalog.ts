export * as Catalog from "./catalog"

import { Config } from "@/config/config"
import { Context, Effect, HashMap, Layer, Option, Order, pipe, Schema, Array } from "effect"
import { produce, type Draft } from "immer"
import { ModelV2 } from "./model"
import { PluginV2 } from "./plugin"
import { ProviderV2 } from "./provider"

type ProviderRecord = {
  provider: ProviderV2.Info
  models: HashMap.HashMap<ModelV2.ID, ModelV2.Info>
}

const defaultPriority = ["gpt-5", "claude-sonnet-4", "big-pickle", "gemini-3-pro"]

function sortDefaultModels(models: ModelV2.Info[]) {
  return [...models].sort((a, b) => {
    const priority =
      defaultPriority.findIndex((filter) => b.id.includes(filter)) -
      defaultPriority.findIndex((filter) => a.id.includes(filter))
    if (priority !== 0) return priority

    const latest = (a.id.includes("latest") ? 0 : 1) - (b.id.includes("latest") ? 0 : 1)
    if (latest !== 0) return latest

    return b.id.localeCompare(a.id)
  })
}

function smallPriority(providerID: ProviderV2.ID) {
  const base = [
    "claude-haiku-4-5",
    "claude-haiku-4.5",
    "3-5-haiku",
    "3.5-haiku",
    "gemini-3-flash",
    "gemini-2.5-flash",
    "gpt-5-nano",
  ]
  if (providerID.startsWith("opencode")) return ["gpt-5-nano"]
  if (providerID.startsWith("github-copilot")) return ["gpt-5-mini", "claude-haiku-4.5", ...base]
  return base
}

function findSmallModel(providerID: ProviderV2.ID, models: ModelV2.Info[]) {
  for (const item of smallPriority(providerID)) {
    if (providerID === ProviderV2.ID.amazonBedrock) {
      const candidates = models.filter((model) => model.id.includes(item))
      const globalMatch = candidates.find((model) => model.id.startsWith("global."))
      if (globalMatch) return globalMatch

      const region = candidates
        .map((model) => model.options.aisdk.provider.region)
        .find((value): value is string => typeof value === "string")
      const regionPrefix = region?.split("-")[0]
      if (regionPrefix === "us" || regionPrefix === "eu") {
        const regionalMatch = candidates.find((model) => model.id.startsWith(`${regionPrefix}.`))
        if (regionalMatch) return regionalMatch
      }

      const unprefixed = candidates.find(
        (model) => !["global.", "us.", "eu."].some((prefix) => model.id.startsWith(prefix)),
      )
      if (unprefixed) return unprefixed
      continue
    }

    const match = models.find((model) => model.id.includes(item))
    if (match) return match
  }
}

export class ProviderNotFoundError extends Schema.TaggedErrorClass<ProviderNotFoundError>()(
  "CatalogV2.ProviderNotFound",
  {
    providerID: ProviderV2.ID,
  },
) {}

export class ModelNotFoundError extends Schema.TaggedErrorClass<ModelNotFoundError>()("CatalogV2.ModelNotFound", {
  providerID: ProviderV2.ID,
  modelID: ModelV2.ID,
}) {}

export interface Interface {
  readonly provider: {
    readonly get: (providerID: ProviderV2.ID) => Effect.Effect<ProviderV2.Info, ProviderNotFoundError>
    readonly update: (providerID: ProviderV2.ID, fn: (provider: Draft<ProviderV2.Info>) => void) => Effect.Effect<void>
    readonly all: () => Effect.Effect<ProviderV2.Info[]>
    readonly available: () => Effect.Effect<ProviderV2.Info[]>
  }
  readonly model: {
    readonly get: (
      providerID: ProviderV2.ID,
      modelID: ModelV2.ID,
    ) => Effect.Effect<ModelV2.Info, ProviderNotFoundError | ModelNotFoundError>
    readonly update: (
      providerID: ProviderV2.ID,
      modelID: ModelV2.ID,
      fn: (model: Draft<ModelV2.Info>) => void,
    ) => Effect.Effect<void, ProviderNotFoundError>
    readonly all: () => Effect.Effect<ModelV2.Info[]>
    readonly available: () => Effect.Effect<ModelV2.Info[]>
    readonly default: () => Effect.Effect<Option.Option<ModelV2.Info>>
    readonly small: (providerID: ProviderV2.ID) => Effect.Effect<Option.Option<ModelV2.Info>>
  }
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/Catalog") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    let records = HashMap.empty<ProviderV2.ID, ProviderRecord>()
    const plugin = yield* PluginV2.Service

    const resolve = (model: ModelV2.Info) => {
      const provider = Option.getOrThrow(HashMap.get(records, model.providerID)).provider
      const endpoint = model.endpoint.type === "unknown" ? provider.endpoint : model.endpoint
      return new ModelV2.Info({
        ...model,
        endpoint,
        options: {
          headers: {
            ...provider.options.headers,
            ...model.options.headers,
          },
          body: {
            ...provider.options.body,
            ...model.options.body,
          },
          aisdk: {
            provider: {
              ...provider.options.aisdk.provider,
              ...model.options.aisdk.provider,
            },
            request: model.options.aisdk.request,
          },
          variant: model.options.variant,
        },
      })
    }

    function* getRecord(providerID: ProviderV2.ID) {
      const match = HashMap.get(records, providerID)
      if (!match.valueOrUndefined) return yield* new ProviderNotFoundError({ providerID })
      return match.value
    }

    const result: Interface = {
      provider: {
        get: Effect.fn("CatalogV2.provider.get")(function* (providerID) {
          const record = yield* getRecord(providerID)
          return record.provider
        }),

        update: Effect.fn("CatalogV2.provider.update")(function* (providerID, fn) {
          const current = Option.getOrUndefined(HashMap.get(records, providerID))
          const provider = produce(current?.provider ?? ProviderV2.Info.empty(providerID), fn)
          const updated = yield* plugin.trigger("provider.update", {
            provider,
            cancel: false,
          })
          records = HashMap.set(records, providerID, {
            provider: updated.provider,
            models: current?.models ?? HashMap.empty<ModelV2.ID, ModelV2.Info>(),
          })
        }),

        all: Effect.fn("CatalogV2.provider.all")(function* () {
          return globalThis.Array.from(HashMap.values(records)).map((record) => record.provider)
        }),

        available: Effect.fn("CatalogV2.provider.available")(function* () {
          return globalThis.Array.from(HashMap.values(records))
            .map((record) => record.provider)
            .filter((provider) => provider.enabled)
        }),
      },

      model: {
        get: Effect.fn("CatalogV2.model.get")(function* (providerID, modelID) {
          const record = yield* getRecord(providerID)
          const model = Option.getOrUndefined(HashMap.get(record.models, modelID))
          if (!model) return yield* new ModelNotFoundError({ providerID, modelID })
          return resolve(model)
        }),

        update: Effect.fn("CatalogV2.model.update")(function* (providerID, modelID, fn) {
          const record = yield* getRecord(providerID)
          const model = produce(
            HashMap.get(record.models, modelID).pipe(Option.getOrElse(() => ModelV2.Info.empty(providerID, modelID))),
            fn,
          )
          const updated = yield* plugin.trigger("model.update", {
            model,
            cancel: false,
          })
          if (updated.cancel) return
          records = HashMap.set(records, providerID, {
            provider: record.provider,
            models: HashMap.set(
              record.models,
              modelID,
              new ModelV2.Info({ ...updated.model, id: modelID, providerID }),
            ),
          })
          return
        }),

        all: Effect.fn("CatalogV2.model.all")(function* () {
          return pipe(
            records,
            HashMap.toValues,
            Array.flatMap((record) => HashMap.toValues(record.models)),
            Array.map(resolve),
            Array.sortWith((item) => item.time.released.epochMilliseconds, Order.flip(Order.Number)),
          )
        }),

        available: Effect.fn("CatalogV2.model.available")(function* () {
          return (yield* result.model.all()).filter((model) => {
            const record = Option.getOrUndefined(HashMap.get(records, model.providerID))
            return record?.provider.enabled !== false && model.enabled
          })
        }),

        default: Effect.fn("CatalogV2.model.default")(function* () {
          const config = Option.getOrUndefined(yield* Effect.serviceOption(Config.Service))
          const cfg = config ? yield* config.get() : undefined
          if (cfg?.model) {
            const parsed = ModelV2.parse(cfg.model)
            const model = yield* result.model.get(parsed.providerID, parsed.modelID).pipe(Effect.option)
            if (Option.isSome(model) && model.value.enabled) return model
          }

          const available = (yield* result.model.available()).filter((model) => {
            if (!cfg?.provider) return true
            return model.providerID in cfg.provider
          })
          return Option.fromUndefinedOr(sortDefaultModels(available)[0])
        }),

        small: Effect.fn("CatalogV2.model.small")(function* (providerID) {
          const config = Option.getOrUndefined(yield* Effect.serviceOption(Config.Service))
          const cfg = config ? yield* config.get() : undefined
          if (cfg?.small_model) {
            const parsed = ModelV2.parse(cfg.small_model)
            const model = yield* result.model.get(parsed.providerID, parsed.modelID).pipe(Effect.option)
            if (Option.isSome(model) && model.value.enabled) return model
          }

          return Option.fromUndefinedOr(
            findSmallModel(
              providerID,
              (yield* result.model.available()).filter((model) => model.providerID === providerID),
            ),
          )
        }),
      },
    }

    return Service.of(result)
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(PluginV2.defaultLayer))
