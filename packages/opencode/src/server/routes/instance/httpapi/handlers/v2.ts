import { Catalog } from "@/v2/catalog"
import { SessionV2 } from "@/v2/session"
import { Layer } from "effect"
import { messageHandlers } from "./v2/message"
import { modelHandlers } from "./v2/model"
import { sessionHandlers } from "./v2/session"

export const v2Handlers = Layer.mergeAll(sessionHandlers, messageHandlers, modelHandlers).pipe(
  Layer.provide(Catalog.defaultLayer),
  Layer.provide(SessionV2.defaultLayer),
)
