import { afterEach, beforeEach, describe, expect, mock } from "bun:test"
import { Effect, Exit, Fiber } from "effect"
import { Database } from "@/storage/db"
import { disposeAllInstances, provideTmpdirInstance } from "../fixture/fixture"
import { resetDatabase } from "../fixture/db"
import { testEffect } from "../lib/effect"
import { TransferLab, type HistoryEvent } from "./transfer-lab"

const originalWorkspaces = process.env.OPENCODE_EXPERIMENTAL_WORKSPACES
const it = testEffect(TransferLab.layer)

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

function sequences(events: HistoryEvent[]) {
  return events.map((event) => event.seq)
}

function titles(events: HistoryEvent[]) {
  return events.flatMap((event) => {
    const info = Reflect.get(event.data, "info")
    if (!info || typeof info !== "object") return []
    const title = Reflect.get(info, "title")
    return typeof title === "string" ? [title] : []
  })
}

function expectFailure(exit: Exit.Exit<unknown, unknown>, ...fragments: string[]) {
  expect(Exit.isFailure(exit)).toBe(true)
  if (!Exit.isFailure(exit)) return
  for (const fragment of fragments) expect(String(exit.cause)).toContain(fragment)
}

describe("workspace transfer contract", () => {
  it.live(
    "imports canonical history into a remote destination on a normal transfer",
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const lab = yield* TransferLab.make()
          const target = yield* lab.remote("normal-target")
          const session = yield* lab.session()

          yield* lab.transfer(session, target)

          expect(sequences(yield* lab.history(target, session))).toEqual([0, 1])
        }),
      { git: true },
    ),
  )

  it.live(
    "keeps source ownership when final source history cannot be read",
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const lab = yield* TransferLab.make()
          const source = yield* lab.remote("history-source")
          const target = yield* lab.remote("history-target")
          const session = yield* lab.sessionOwnedBy(source)
          source.failNextHistoryRead()

          const exit = yield* Effect.exit(lab.transfer(session, target))

          expectFailure(exit, "WorkspaceSyncHttpError", "503")
          expect(lab.owner(session)).toBe(source.id)
        }),
      { git: true },
    ),
  )

  it.live(
    "keeps source ownership when destination import is rejected",
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const lab = yield* TransferLab.make()
          const source = yield* lab.remote("import-source")
          const target = yield* lab.remote("import-target")
          const session = yield* lab.sessionOwnedBy(source)
          target.rejectNextImport()

          const exit = yield* Effect.exit(lab.transfer(session, target))

          expectFailure(exit, "WorkspaceSessionWarpHttpError", "503")
          expect(lab.owner(session)).toBe(source.id)
        }),
      { git: true },
    ),
  )

  it.live(
    "does not lose a write accepted while destination import is paused",
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const lab = yield* TransferLab.make()
          const source = yield* lab.remote("inflight-source")
          const target = yield* lab.remote("inflight-target")
          const session = yield* lab.sessionOwnedBy(source)
          const importRequest = yield* target.pauseNextImport()
          const transfer = yield* Effect.forkChild(lab.transfer(session, target))

          yield* importRequest.started
          yield* lab.acceptWrite(session, "accepted while importing")
          yield* importRequest.resume
          const exit = yield* Fiber.await(transfer)

          if (Exit.isFailure(exit)) {
            expect(lab.owner(session)).toBe(source.id)
            return
          }
          expect(lab.owner(session)).toBe(target.id)
          expect(titles(yield* lab.history(target, session))).toContain("accepted while importing")
        }),
      { git: true },
    ),
  )

  it.live(
    "keeps source ownership when destination commit is rejected",
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const lab = yield* TransferLab.make()
          const source = yield* lab.remote("commit-source")
          const target = yield* lab.remote("commit-target")
          const session = yield* lab.sessionOwnedBy(source)
          target.rejectNextCommit()

          const exit = yield* Effect.exit(lab.transfer(session, target))

          expectFailure(exit, "WorkspaceSessionWarpHttpError", "409")
          expect(lab.owner(session)).toBe(source.id)
        }),
      { git: true },
    ),
  )

  it.live(
    "permits at most one concurrent destination to commit",
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const lab = yield* TransferLab.make()
          const source = yield* lab.remote("race-source")
          const east = yield* lab.remote("race-east")
          const west = yield* lab.remote("race-west")
          const session = yield* lab.sessionOwnedBy(source)

          const results = yield* Effect.all(
            [Effect.exit(lab.transfer(session, east)), Effect.exit(lab.transfer(session, west))],
            { concurrency: "unbounded" },
          )

          expect(results.filter(Exit.isSuccess)).toHaveLength(1)
        }),
      { git: true },
    ),
  )

  it.live(
    "does not duplicate a committed transfer when its acknowledgement is lost",
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const lab = yield* TransferLab.make()
          const target = yield* lab.remote("lost-ack-target")
          const session = yield* lab.session()
          target.loseNextCommitAcknowledgement()

          expectFailure(yield* Effect.exit(lab.transfer(session, target)), "WorkspaceSessionWarpHttpError", "503")
          expect(sequences(yield* lab.history(target, session))).toEqual([0, 1])

          expect(Exit.isSuccess(yield* Effect.exit(lab.transfer(session, target)))).toBe(true)
          expect(sequences(yield* lab.history(target, session))).toEqual([0, 1])
        }),
      { git: true },
    ),
  )

  it.live(
    "preserves retained canonical history when moving back to a former owner",
    provideTmpdirInstance(
      () =>
        Effect.gen(function* () {
          const lab = yield* TransferLab.make()
          const first = yield* lab.remote("return-first")
          const second = yield* lab.remote("return-second")
          const session = yield* lab.sessionOwnedBy(first)

          yield* lab.transfer(session, second)
          yield* lab.observeOwner(session, second)
          expect((yield* lab.write(second, session, "written on second")).status).toBe(200)
          yield* lab.transfer(session, first)

          expect(sequences(yield* lab.history(first, session))).toEqual([0, 1, 2, 3, 4])
          expect(titles(yield* lab.history(first, session))).toContain("written on second")
        }),
      { git: true },
    ),
  )
})
