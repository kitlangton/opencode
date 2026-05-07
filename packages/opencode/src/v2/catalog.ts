export * as Catalog from "./catalog"

import { Context, Effect, HashMap, Layer, Option, Order, pipe, Schema, Array } from "effect"
import { produce, type Draft } from "immer"
import { ModelV2 } from "./model"
import { PluginV2 } from "./plugin"
import { ProviderV2 } from "./provider"

type ProviderRecord = {
  provider: ProviderV2.Info
  models: HashMap.HashMap<ModelV2.ID, ModelV2.Info>
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
    readonly setDefault: (
      providerID: ProviderV2.ID,
      modelID: ModelV2.ID,
    ) => Effect.Effect<void, ProviderNotFoundError | ModelNotFoundError>
    readonly small: (providerID: ProviderV2.ID) => Effect.Effect<Option.Option<ModelV2.Info>>
  }
}

export class Service extends Context.Service<Service, Interface>()("@opencode/v2/Catalog") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    let records = HashMap.empty<ProviderV2.ID, ProviderRecord>()
    let defaultModel: { providerID: ProviderV2.ID; modelID: ModelV2.ID } | undefined
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

        update: Effect.fnUntraced(function* (providerID, fn) {
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

        update: Effect.fnUntraced(function* (providerID, modelID, fn) {
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
          if (defaultModel) {
            const model = yield* result.model.get(defaultModel.providerID, defaultModel.modelID).pipe(Effect.option)
            if (Option.isSome(model) && model.value.enabled) return model
          }

          return pipe(
            yield* result.model.available(),
            Array.sortWith((item) => item.time.released.epochMilliseconds, Order.flip(Order.Number)),
            Array.head,
          )
        }),

        setDefault: Effect.fn("CatalogV2.model.setDefault")(function* (providerID, modelID) {
          yield* result.model.get(providerID, modelID)
          defaultModel = { providerID, modelID }
        }),

        small: Effect.fn("CatalogV2.model.small")(function* (providerID) {
          const record = Option.getOrUndefined(HashMap.get(records, providerID))
          if (!record) return Option.none<ModelV2.Info>()
          return pipe(
            HashMap.toValues(record.models),
            Array.filter((model) => model.providerID === providerID && model.enabled && model.status === "active"),
            Array.sortWith(
              (model) =>
                [model.cost[0]?.output ?? Number.POSITIVE_INFINITY, -model.time.released.epochMilliseconds] as const,
              Order.Tuple([Order.Number, Order.Number]),
            ),
            Array.map(resolve),
            Array.head,
          )
        }),
      },
    }

    return Service.of(result)
  }),
)

export const defaultLayer = layer.pipe(Layer.provide(PluginV2.defaultLayer))
