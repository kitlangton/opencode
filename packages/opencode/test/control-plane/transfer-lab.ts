import Http from "node:http"
import path from "node:path"
import { NodeHttpServer } from "@effect/platform-node"
import { AppFileSystem } from "@opencode-ai/core/filesystem"
import { Deferred, Duration, Effect, Layer, Schema, Stream } from "effect"
import { FetchHttpClient, HttpServer, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { eq } from "drizzle-orm"
import { Auth } from "@/auth"
import { InstanceBootstrap } from "@/project/bootstrap"
import { InstanceStore } from "@/project/instance-store"
import { Session as SessionNs } from "@/session/session"
import { SessionTable } from "@/session/session.sql"
import { SessionPrompt } from "@/session/prompt"
import { Project } from "@/project/project"
import { Vcs } from "@/project/vcs"
import { Database } from "@/storage/db"
import { EventSequenceTable } from "@/sync/event.sql"
import { SyncEvent } from "@/sync"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { SessionPaths } from "@/server/routes/instance/httpapi/groups/session"
import { SyncPaths } from "@/server/routes/instance/httpapi/groups/sync"
import { registerAdapter } from "@/control-plane/adapters"
import { WorkspaceID } from "@/control-plane/schema"
import { WorkspaceTable } from "@/control-plane/workspace.sql"
import type { WorkspaceAdapter } from "@/control-plane/types"
import * as Workspace from "@/control-plane/workspace"
import { requireInstance, tmpdirScoped } from "../fixture/fixture"

const workspaceLayer = Workspace.layer.pipe(
  Layer.provide(Auth.defaultLayer),
  Layer.provide(SessionNs.defaultLayer),
  Layer.provide(SyncEvent.defaultLayer),
  Layer.provide(SessionPrompt.defaultLayer),
  Layer.provide(Project.defaultLayer),
  Layer.provide(Vcs.defaultLayer),
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(AppFileSystem.defaultLayer),
  Layer.provide(RuntimeFlags.layer({ experimentalWorkspaces: true })),
  Layer.provide(InstanceStore.defaultLayer.pipe(Layer.provide(InstanceBootstrap.defaultLayer))),
)

export const layer = Layer.mergeAll(
  NodeHttpServer.layer(Http.createServer, { host: "127.0.0.1", port: 0 }),
  workspaceLayer,
  SessionNs.defaultLayer,
)

type Action = "history" | "import" | "commit"
type Fault =
  | { tag: "reject"; status: number; body: string }
  | { tag: "lose-ack"; status: number; body: string }
  | { tag: "pause"; started: Deferred.Deferred<void>; resume: Deferred.Deferred<void> }

export type HistoryEvent = {
  id: string
  aggregate_id: string
  seq: number
  type: string
  data: Record<string, unknown>
}

export type Pause = {
  started: Effect.Effect<void>
  resume: Effect.Effect<boolean>
}

export type Remote = {
  readonly id: WorkspaceID
  readonly name: string
  readonly directory: string
  readonly url: string
  failNextHistoryRead: (status?: number) => void
  rejectNextImport: (status?: number) => void
  rejectNextCommit: (status?: number) => void
  loseNextCommitAcknowledgement: (status?: number) => void
  pauseNextImport: () => Effect.Effect<Pause>
}

type Node = Remote & { faults: Partial<Record<Action, Fault>>; prefix: string }
const cliEntry = path.resolve(import.meta.dir, "../../src/index.ts")

export const make = Effect.fn("TransferLab.make")(function* () {
  const workspace = yield* Workspace.Service
  const sessionSvc = yield* SessionNs.Service
  const instance = yield* requireInstance
  const nodes = new Map<string, Node>()
  const url = HttpServer.formatAddress((yield* HttpServer.HttpServer).address)

  yield* HttpServer.serveEffect()(
    Effect.gen(function* () {
      const req = yield* HttpServerRequest.HttpServerRequest
      const requestURL = new URL(req.url, "http://localhost")
      const node = [...nodes.values()].find((item) => requestURL.pathname.startsWith(item.prefix))
      if (!node) return HttpServerResponse.text("unknown transfer lab remote", { status: 500 })
      const path = requestURL.pathname.slice(node.prefix.length)
      const action =
        path === SyncPaths.history
          ? "history"
          : path === SyncPaths.replay
            ? "import"
            : path === SyncPaths.steal
              ? "commit"
              : undefined
      const fault = action ? node.faults[action] : undefined
      if (action) delete node.faults[action]
      if (fault?.tag === "reject") return HttpServerResponse.text(fault.body, { status: fault.status })
      if (fault?.tag === "pause") {
        yield* Deferred.succeed(fault.started, undefined)
        yield* Deferred.await(fault.resume)
      }
      const response = yield* requestRemote(node, path, req.method, yield* req.text)
      if (fault?.tag === "lose-ack") {
        yield* Effect.promise(() => response.text())
        return HttpServerResponse.text(fault.body, { status: fault.status })
      }
      return HttpServerResponse.fromWeb(response)
    }),
  )

  const remote = (name: string) =>
    Effect.gen(function* () {
      const home = yield* tmpdirScoped()
      // Remote nodes share the logical project directory but have independent durable databases.
      const directory = instance.directory
      const id = WorkspaceID.ascending(`wrk_lab_${name}`)
      const process = yield* startRemote(home, id)
      const info: Workspace.Info = {
        id,
        type: `transfer-lab-${name}`,
        name,
        branch: null,
        directory,
        extra: null,
        projectID: instance.project.id,
        timeUsed: Date.now(),
      }
      const node: Node = {
        id: info.id,
        name,
        directory,
        url: process.url,
        prefix: `/transfer-lab/${name}`,
        faults: {},
        failNextHistoryRead(status = 503) {
          node.faults.history = { tag: "reject", status, body: "history unavailable" }
        },
        rejectNextImport(status = 503) {
          node.faults.import = { tag: "reject", status, body: "import rejected" }
        },
        rejectNextCommit(status = 409) {
          node.faults.commit = { tag: "reject", status, body: "commit rejected" }
        },
        loseNextCommitAcknowledgement(status = 503) {
          node.faults.commit = { tag: "lose-ack", status, body: "acknowledgement lost" }
        },
        pauseNextImport: () =>
          Effect.gen(function* () {
            const started = yield* Deferred.make<void>()
            const resume = yield* Deferred.make<void>()
            node.faults.import = { tag: "pause", started, resume }
            return { started: Deferred.await(started), resume: Deferred.succeed(resume, undefined) }
          }),
      }
      nodes.set(name, node)
      insertWorkspace(info)
      registerAdapter(instance.project.id, info.type, remoteAdapter(`${url}${node.prefix}`, directory))
      return node
    })

  // The lab does not run remote SSE listeners; model the control plane observing a committed remote owner event.
  const observeOwner = (session: SessionNs.Info, remote: Remote) =>
    Effect.sync(() => {
      Database.use((db) => {
        db.update(SessionTable).set({ workspace_id: remote.id }).where(eq(SessionTable.id, session.id)).run()
        db.update(EventSequenceTable)
          .set({ owner_id: remote.id })
          .where(eq(EventSequenceTable.aggregate_id, session.id))
          .run()
      })
    })

  const transfer = (session: SessionNs.Info, remote: Remote) =>
    workspace.sessionWarp({ workspaceID: remote.id, sessionID: session.id })

  const history = (remote: Remote, session: SessionNs.Info) =>
    Effect.gen(function* () {
      const response = yield* requestRemote(remote, SyncPaths.history, "POST", "{}")
      return Schema.decodeUnknownSync(
        Schema.Array(
          Schema.Struct({
            id: Schema.String,
            aggregate_id: Schema.String,
            seq: Schema.Number,
            type: Schema.String,
            data: Schema.Record(Schema.String, Schema.Unknown),
          }),
        ),
      )(yield* Effect.promise(() => response.json())).filter((event) => event.aggregate_id === session.id)
    })

  return {
    remote,
    session: () => sessionSvc.create({}),
    sessionOwnedBy: (remote: Remote) =>
      Effect.gen(function* () {
        const session = yield* sessionSvc.create({})
        yield* transfer(session, remote)
        yield* observeOwner(session, remote)
        return session
      }),
    transfer,
    observeOwner,
    owner: (session: SessionNs.Info) => {
      const owner = Database.use((db) =>
        db
          .select({ owner: EventSequenceTable.owner_id })
          .from(EventSequenceTable)
          .where(eq(EventSequenceTable.aggregate_id, session.id))
          .get(),
      )?.owner
      return owner === null || owner === undefined ? owner : WorkspaceID.make(owner)
    },
    acceptWrite: (session: SessionNs.Info, title: string) => sessionSvc.setTitle({ sessionID: session.id, title }),
    write: (remote: Remote, session: SessionNs.Info, title: string) =>
      requestRemote(remote, SessionPaths.update.replace(":sessionID", session.id), "PATCH", JSON.stringify({ title })),
    history,
  }
})

function insertWorkspace(info: Workspace.Info) {
  Database.use((db) =>
    db
      .insert(WorkspaceTable)
      .values({
        id: info.id,
        type: info.type,
        branch: info.branch,
        name: info.name,
        directory: info.directory,
        extra: info.extra,
        project_id: info.projectID,
        time_used: info.timeUsed,
      })
      .run(),
  )
}

function remoteAdapter(url: string, directory: string): WorkspaceAdapter {
  return {
    name: "Transfer Lab Remote",
    description: "Transfer Lab Remote",
    configure: (info) => ({ ...info, directory }),
    async create() {},
    async remove() {},
    target: () => ({ type: "remote", url }),
  }
}

function requestRemote(remote: Pick<Remote, "url" | "directory">, path: string, method: string, body: string) {
  return Effect.promise(() =>
    fetch(`${remote.url}${path}`, {
      method,
      headers: { "content-type": "application/json", "x-opencode-directory": remote.directory },
      body,
    }),
  )
}

function startRemote(directory: string, workspaceID: WorkspaceID) {
  return Effect.gen(function* () {
    const child = yield* Effect.acquireRelease(
      Effect.sync(() =>
        Bun.spawn(["bun", "run", "--conditions=browser", cliEntry, "serve", "--hostname", "127.0.0.1", "--port", "0"], {
          cwd: directory,
          env: {
            ...process.env,
            HOME: directory,
            XDG_CONFIG_HOME: path.join(directory, ".config"),
            XDG_DATA_HOME: path.join(directory, ".local/share"),
            XDG_STATE_HOME: path.join(directory, ".local/state"),
            XDG_CACHE_HOME: path.join(directory, ".cache"),
            OPENCODE_TEST_HOME: directory,
            OPENCODE_DB: path.join(directory, "opencode.db"),
            OPENCODE_WORKSPACE_ID: workspaceID,
            OPENCODE_EXPERIMENTAL_WORKSPACES: "true",
            OPENCODE_DISABLE_PROJECT_CONFIG: "1",
            OPENCODE_DISABLE_AUTOUPDATE: "1",
            OPENCODE_DISABLE_AUTOCOMPACT: "1",
            OPENCODE_DISABLE_MODELS_FETCH: "1",
            OPENCODE_PURE: "1",
            OPENCODE_AUTH_CONTENT: "{}",
          },
          stdout: "pipe",
          stderr: "pipe",
        }),
      ),
      (process) =>
        Effect.promise(() => {
          process.kill()
          return process.exited
        }).pipe(Effect.ignore),
    )
    const ready = yield* Deferred.make<string>()
    yield* Effect.forkScoped(
      Stream.fromReadableStream({ evaluate: () => child.stdout, onError: (cause) => new Error(String(cause)) }).pipe(
        Stream.decodeText(),
        Stream.splitLines,
        Stream.runForEach((line) => {
          const match = line.match(/listening on (http:\/\/[^\s]+)/)
          return match ? Deferred.succeed(ready, match[1]) : Effect.void
        }),
        Effect.ignore({ log: true }),
      ),
    )
    yield* Effect.forkScoped(
      Stream.fromReadableStream({ evaluate: () => child.stderr, onError: (cause) => new Error(String(cause)) }).pipe(
        Stream.runDrain,
        Effect.ignore,
      ),
    )
    return {
      url: yield* Deferred.await(ready).pipe(
        Effect.timeoutOrElse({
          duration: Duration.seconds(20),
          orElse: () => Effect.fail(new Error(`remote workspace server did not start: ${workspaceID}`)),
        }),
      ),
    }
  })
}

export * as TransferLab from "./transfer-lab"
