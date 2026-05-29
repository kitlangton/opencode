import { afterEach, beforeEach, describe, expect, mock } from "bun:test"
import { Effect } from "effect"
import { Database } from "@/storage/db"
import { disposeAllInstances, provideTmpdirInstance } from "../fixture/fixture"
import { resetDatabase } from "../fixture/db"
import { testEffect } from "../lib/effect"
import { AssignmentLab, type HistoryEvent } from "./workspace-assignment-lab"

const originalWorkspaces = process.env.OPENCODE_EXPERIMENTAL_WORKSPACES
const it = testEffect(AssignmentLab.layer)

beforeEach(() => {
  Database.close()
  process.env.OPENCODE_EXPERIMENTAL_WORKSPACES = "true"
})

afterEach(async () => {
  mock.restore()
  await disposeAllInstances()
  if (originalWorkspaces === undefined) delete process.env.OPENCODE_EXPERIMENTAL_WORKSPACES
  else process.env.OPENCODE_EXPERIMENTAL_WORKSPACES = originalWorkspaces
  await resetDatabase()
})

function titles(events: HistoryEvent[]) {
  return events.flatMap((event) => {
    const info = Reflect.get(event.data, "info")
    if (!info || typeof info !== "object") return []
    const title = Reflect.get(info, "title")
    return typeof title === "string" ? [title] : []
  })
}

function workspaceAssignments(events: HistoryEvent[]) {
  return events.flatMap((event) => {
    const info = Reflect.get(event.data, "info")
    if (!info || typeof info !== "object") return []
    const workspaceID = Reflect.get(info, "workspaceID")
    return typeof workspaceID === "string" ? [workspaceID] : []
  })
}

describe("workspace assignment sole-writer contract", () => {
  it.live(
    "assigning a remote workspace appends the assignment in the control-plane history",
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const lab = yield* AssignmentLab.make()
          const target = yield* lab.remote("assigned-target")
          const session = yield* lab.session()

          yield* lab.assign(session, target)

          expect(workspaceAssignments(yield* lab.canonicalHistory(session))).toContain(target.id)
        }),
      { git: true },
    ),
  )

  it.live(
    "assigning a remote workspace does not append the assignment in the remote history",
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const lab = yield* AssignmentLab.make()
          const target = yield* lab.remote("remote-assignment-target")
          const session = yield* lab.session()

          yield* lab.assign(session, target)

          expect(workspaceAssignments(yield* lab.history(target, session))).not.toContain(target.id)
        }),
      { git: true },
    ),
  )

  it.live(
    "an assigned remote workspace cannot append authoritative session events locally",
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const lab = yield* AssignmentLab.make()
          const target = yield* lab.remote("write-target")
          const session = yield* lab.session()
          yield* lab.assign(session, target)
          const before = yield* lab.history(target, session)

          yield* lab.write(target, session, "written remotely")

          expect(yield* lab.history(target, session)).toEqual(before)
        }),
      { git: true },
    ),
  )

  it.live(
    "a previous remote assignment cannot append a late session event after reassignment",
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const lab = yield* AssignmentLab.make()
          const source = yield* lab.remote("late-source")
          const target = yield* lab.remote("late-target")
          const session = yield* lab.sessionAssignedTo(source)
          yield* lab.assign(session, target)
          const before = yield* lab.history(source, session)

          yield* lab.write(source, session, "late source write")

          expect(yield* lab.history(source, session)).toEqual(before)
          expect(titles(yield* lab.history(source, session))).not.toContain("late source write")
        }),
      { git: true },
    ),
  )
})
