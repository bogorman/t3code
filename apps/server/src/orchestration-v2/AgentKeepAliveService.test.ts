import { describe, expect, it } from "@effect/vitest";
import { RunId, ThreadId } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

import { AGENT_NUDGE_INTERVAL_MS, needsAgentNudge } from "./AgentKeepAliveService.ts";

const NOW = Date.parse("2026-10-12T12:00:00.000Z");
const keptOn = {
  id: ThreadId.make("thread-1"),
  keepAgentOnAt: DateTime.makeUnsafe(NOW - 60_000),
  archivedAt: null,
  settledOverride: null,
  agentSessionStatus: "stopped" as const,
  activeRunId: null,
  pendingRuntimeRequest: null,
};

describe("needsAgentNudge", () => {
  it("nudges a kept-on thread whose agent went offline", () => {
    expect(needsAgentNudge(keptOn, NOW, undefined)).toBe(true);
    expect(needsAgentNudge({ ...keptOn, agentSessionStatus: "error" }, NOW, undefined)).toBe(true);
  });

  it("leaves online, never-started, busy, waiting, parked and not-kept-on threads alone", () => {
    for (const thread of [
      { ...keptOn, agentSessionStatus: "ready" as const },
      { ...keptOn, agentSessionStatus: null },
      { ...keptOn, activeRunId: RunId.make("run-1") },
      { ...keptOn, pendingRuntimeRequest: {} as never },
      { ...keptOn, settledOverride: "settled" as const },
      { ...keptOn, archivedAt: DateTime.makeUnsafe(NOW) },
      { ...keptOn, keepAgentOnAt: null },
    ]) {
      expect(needsAgentNudge(thread, NOW, undefined)).toBe(false);
    }
  });

  it("nudges again only after the interval", () => {
    expect(needsAgentNudge(keptOn, NOW, NOW - 60_000)).toBe(false);
    expect(needsAgentNudge(keptOn, NOW, NOW - AGENT_NUDGE_INTERVAL_MS)).toBe(true);
  });
});
