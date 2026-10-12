import {
  CommandId,
  MessageId,
  type OrchestrationV2ThreadShell,
  type ThreadId,
} from "@t3tools/contracts";
import { resolveProjectSettings } from "@t3tools/shared/projectSettings";
import { threadAgentIsOnline } from "@t3tools/shared/threadAgent";
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";

import * as ServerSettings from "../serverSettings.ts";
import { forkParked } from "../serverActivation.ts";
import * as Orchestrator from "./Orchestrator.ts";

/** A kept-on agent that went offline is nudged at most this often. */
export const AGENT_NUDGE_INTERVAL_MS = 15 * 60 * 1_000;

type KeepAliveThread = Pick<
  OrchestrationV2ThreadShell,
  | "id"
  | "keepAgentOnAt"
  | "archivedAt"
  | "settledOverride"
  | "agentSessionStatus"
  | "activeRunId"
  | "pendingRuntimeRequest"
>;

/**
 * Whether a kept-on thread's agent should be nudged now: it is offline (its
 * provider session stopped or failed), the thread is not busy or waiting on the
 * user, it was not nudged since it was last seen online, and not in the last
 * interval. `nudgedAtMs` is undefined when it was seen online since.
 */
export function needsAgentNudge(
  thread: KeepAliveThread,
  nowMs: number,
  nudgedAtMs: number | undefined,
): boolean {
  if (thread.keepAgentOnAt == null) return false;
  if (thread.archivedAt !== null || thread.settledOverride === "settled") return false;
  if (thread.agentSessionStatus == null || threadAgentIsOnline(thread.agentSessionStatus)) {
    return false;
  }
  if (thread.activeRunId !== null || thread.pendingRuntimeRequest != null) return false;
  return nudgedAtMs === undefined || nowMs - nudgedAtMs >= AGENT_NUDGE_INTERVAL_MS;
}

/**
 * Keeps agents on: every minute, sends the project's nudge message to each
 * kept-on thread whose agent has gone offline. Sending a message starts its
 * provider session again. A thread is nudged once per offline spell (and no
 * more than once per interval), so a session that keeps stopping can't loop.
 */
export const make = Effect.gen(function* () {
  const orchestrator = yield* Orchestrator.OrchestratorV2;
  const settingsService = yield* ServerSettings.ServerSettingsService;
  const crypto = yield* Crypto.Crypto;
  const nudgedAt = new Map<ThreadId, number>();

  const nudge = (thread: KeepAliveThread & Pick<OrchestrationV2ThreadShell, "projectId">) =>
    Effect.gen(function* () {
      const text = resolveProjectSettings(yield* settingsService.getSettings, thread.projectId)
        .settings.agentNudgePrompt;
      const uuid = yield* crypto.randomUUIDv4;
      yield* orchestrator.dispatch({
        type: "message.dispatch",
        commandId: CommandId.make(`server:agent-nudge:${thread.id}:${uuid}`),
        threadId: thread.id,
        messageId: MessageId.make(`message:agent-nudge:${uuid}`),
        text,
        attachments: [],
        dispatchMode: { type: "start_immediately" },
        createdBy: "system",
        creationSource: "server",
      });
      yield* Effect.logInfo("nudged a kept-on agent", { threadId: thread.id });
    }).pipe(
      Effect.catchCause((cause) =>
        Cause.hasInterruptsOnly(cause)
          ? Effect.failCause(cause)
          : Effect.logWarning("nudging a kept-on agent failed", {
              threadId: thread.id,
              cause: Cause.pretty(cause),
            }),
      ),
    );

  const sweep = Effect.gen(function* () {
    const snapshot = yield* orchestrator.getShellSnapshot();
    const nowMs = yield* Clock.currentTimeMillis;
    for (const thread of snapshot.threads) {
      if (threadAgentIsOnline(thread.agentSessionStatus)) nudgedAt.delete(thread.id);
      if (!needsAgentNudge(thread, nowMs, nudgedAt.get(thread.id))) continue;
      nudgedAt.set(thread.id, nowMs);
      yield* nudge(thread);
    }
  }).pipe(
    Effect.catchCause((cause) =>
      Cause.hasInterruptsOnly(cause)
        ? Effect.failCause(cause)
        : Effect.logWarning("agent keep-alive sweep failed", { cause: Cause.pretty(cause) }),
    ),
  );

  const start = () =>
    forkParked(sweep.pipe(Effect.repeat(Schedule.spaced("1 minute")), Effect.asVoid));

  return { start, sweep };
});
