import { ModelV2 } from "@/v2/model"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../../api"

export const modelHandlers = HttpApiBuilder.group(InstanceHttpApi, "v2.model", (handlers) =>
  Effect.gen(function* () {
    const model = yield* ModelV2.Service

    return handlers.handle("models", () => model.all())
  }),
)
