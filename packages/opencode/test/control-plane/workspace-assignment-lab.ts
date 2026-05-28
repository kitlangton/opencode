import Http from "node:http"
import path from "node:path"
import { NodeHttpServer } from "@effect/platform-node"
import { AppFileSystem } from "@opencode-ai/core/filesystem"
import { Deferred, Duration, Effect, Layer, Schema, Stream } from "effect"
import { FetchHttpClient, HttpServer, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { asc, eq } from "drizzle-orm"
import { Auth } from "@/auth"
import { InstanceBootstrap } from "@/project/bootstrap"
import { InstanceStore } from "@/project/instance-store"
import { Session as SessionNs } from "@/session/session"
import { SessionTable } from "@/session/session.sql"
import { SessionPrompt } from "@/session/prompt"
import { Project } from "@/project/project"
import { Vcs } from "@/project/vcs"
import { Database } from "@/storage/db"
import { EventSequenceTable, EventTable } from "@/sync/event.sql"
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

export type HistoryEvent = {
  id: string
  aggregate_id: string
  seq: number
  type: string
  data: Record<string, unknown>
}

export type Remote = {
  readonly id: WorkspaceID
  readonly name: string
  readonly directory: string
  readonly url: string
}

type Node = Remote & { prefix: string }
const cliEntry = path.resolve(import.meta.dir, "../../src/index.ts")

export const make = Effect.fn("AssignmentLab.make")(function* () {
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
      if (!node) return HttpServerResponse.text("unknown assignment lab remote", { status: 500 })
      const route = requestURL.pathname.slice(node.prefix.length)
      return HttpServerResponse.fromWeb(yield* requestRemote(node, route, req.method, yield* req.text))
    }),
  )

  const remote = (name: string) =>
    Effect.gen(function* () {
      const home = yield* tmpdirScoped()
      // Nodes share one logical project, but each child has an independent durable database.
      const directory = instance.directory
      const id = WorkspaceID.ascending(`wrk_lab_${name}`)
      const process = yield* startRemote(home, id)
      const info: Workspace.Info = {
        id,
        type: `assignment-lab-${name}`,
        name,
        branch: null,
        directory,
        extra: null,
        projectID: instance.project.id,
        timeUsed: Date.now(),
      }
      const node: Node = {
        id,
        name,
        directory,
        url: process.url,
        prefix: `/assignment-lab/${name}`,
      }
      nodes.set(name, node)
      insertWorkspace(info)
      registerAdapter(instance.project.id, info.type, remoteAdapter(`${url}${node.prefix}`, directory))
      return node
    })

  const assign = (session: SessionNs.Info, remote: Remote) =>
    workspace.sessionWarp({ workspaceID: remote.id, sessionID: session.id })

  // This lab does not run SSE collection. Bridge current remote location observation for a reassignment scenario.
  const observeAssignment = (session: SessionNs.Info, remote: Remote) =>
    Effect.sync(() => {
      Database.use((db) => {
        db.update(SessionTable).set({ workspace_id: remote.id }).where(eq(SessionTable.id, session.id)).run()
        db.update(EventSequenceTable)
          .set({ owner_id: remote.id })
          .where(eq(EventSequenceTable.aggregate_id, session.id))
          .run()
      })
    })

  const history = (remote: Remote, session: SessionNs.Info) =>
    Effect.gen(function* () {
      const response = yield* requestRemote(remote, SyncPaths.history, "POST", "{}")
      return decodeHistory(yield* Effect.promise(() => response.json())).filter(
        (event) => event.aggregate_id === session.id,
      )
    })

  return {
    remote,
    session: () => sessionSvc.create({}),
    sessionAssignedTo: (remote: Remote) =>
      Effect.gen(function* () {
        const session = yield* sessionSvc.create({})
        yield* assign(session, remote)
        yield* observeAssignment(session, remote)
        return session
      }),
    assign,
    canonicalHistory: (session: SessionNs.Info) =>
      Effect.sync(() =>
        Database.use((db) =>
          db
            .select()
            .from(EventTable)
            .where(eq(EventTable.aggregate_id, session.id))
            .orderBy(asc(EventTable.seq))
            .all(),
        ),
      ),
    history,
    write: (remote: Remote, session: SessionNs.Info, title: string) =>
      requestRemote(remote, SessionPaths.update.replace(":sessionID", session.id), "PATCH", JSON.stringify({ title })),
  }
})

const decodeHistory = Schema.decodeUnknownSync(
  Schema.Array(
    Schema.Struct({
      id: Schema.String,
      aggregate_id: Schema.String,
      seq: Schema.Number,
      type: Schema.String,
      data: Schema.Record(Schema.String, Schema.Unknown),
    }),
  ),
)

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
    name: "Assignment Lab Remote",
    description: "Assignment Lab Remote",
    configure: (info) => ({ ...info, directory }),
    async create() {},
    async remove() {},
    target: () => ({ type: "remote", url }),
  }
}

function requestRemote(remote: Pick<Remote, "url" | "directory">, route: string, method: string, body: string) {
  return Effect.promise(() =>
    fetch(`${remote.url}${route}`, {
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

export * as AssignmentLab from "./workspace-assignment-lab"
