import { assert, it } from "@effect/vitest";
import {
  CommandId,
  ProjectId,
  ProviderDriverKind,
  ProviderInstanceId,
  ThreadId,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as SqlitePersistence from "../persistence/Sqlite.ts";
import { CodexProviderCapabilitiesV2 } from "./Adapters/CodexAdapterV2.ts";
import * as Orchestrator from "./Orchestrator.ts";
import * as ProjectionStore from "./ProjectionStore.ts";
import * as ProviderAdapterRegistry from "./ProviderAdapterRegistry.ts";
import * as ProviderReplayHarness from "./testkit/ProviderReplayHarness.ts";
import type * as ProviderAdapter from "@t3tools/provider-core/server/ProviderAdapter";

const instanceId = ProviderInstanceId.make("codex");
const adapter = {
  instanceId,
  driver: ProviderDriverKind.make("codex"),
  getCapabilities: () => Effect.succeed(CodexProviderCapabilitiesV2),
  planSelectionTransition: () => Effect.succeed({ type: "apply_on_next_turn" as const }),
  openSession: () => Effect.die("No provider process needed for thread links"),
} as ProviderAdapter.ProviderAdapterV2["Service"];
const layerDatabase = SqlitePersistence.layerMemory;
const layerTest = Layer.mergeAll(
  layerDatabase,
  ProjectionStore.layer.pipe(Layer.provide(layerDatabase)),
  ProviderReplayHarness.layerWithRegistry(
    { name: "thread-links" },
    ProviderAdapterRegistry.layerFromAdapters([adapter]),
    { databaseLayer: layerDatabase, runEffectWorker: false },
  ),
);

it.effect("links a thread to a group and unlinks it, and a repeat is a no-op", () =>
  Effect.gen(function* () {
    const orchestrator = yield* Orchestrator.OrchestratorV2;
    const projections = yield* ProjectionStore.ProjectionStoreV2;
    const threadId = ThreadId.make("thread:link");
    yield* orchestrator.dispatch({
      type: "thread.create",
      commandId: CommandId.make("create-link"),
      threadId,
      projectId: ProjectId.make("project:link"),
      title: "Linked",
      modelSelection: { instanceId, model: "gpt-5.1-codex" },
      runtimeMode: "full-access",
      interactionMode: "default",
      branch: null,
      worktreePath: null,
      createdBy: "user",
      creationSource: "web",
    });
    const shellOf = Effect.fn(function* () {
      const shell = yield* projections.getThreadShell(threadId);
      assert.ok(shell);
      return shell;
    });

    yield* orchestrator.dispatch({
      type: "thread.link",
      commandId: CommandId.make("link-1"),
      threadId,
      linkGroupId: "group-a",
    });
    const linked = yield* shellOf();
    assert.equal(linked.linkGroupId, "group-a");
    assert.equal((yield* projections.getThreadProjection(threadId)).thread.linkGroupId, "group-a");

    yield* orchestrator.dispatch({
      type: "thread.link",
      commandId: CommandId.make("link-2"),
      threadId,
      linkGroupId: "group-a",
    });
    assert.deepStrictEqual((yield* shellOf()).updatedAt, linked.updatedAt);

    yield* orchestrator.dispatch({
      type: "thread.unlink",
      commandId: CommandId.make("unlink-1"),
      threadId,
    });
    assert.equal((yield* shellOf()).linkGroupId, null);
  }).pipe(Effect.provide(layerTest)),
);
