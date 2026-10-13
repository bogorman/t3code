import { describe, expect, it } from "vite-plus/test";

import {
  type AgentProjectThreadInput,
  resolveThreadAgentState,
  summarizeAgentProjects,
  threadAgentIsActive,
} from "./threadAgent.ts";

interface TestThread extends AgentProjectThreadInput {
  readonly id: string;
  readonly project: string;
}

function thread(
  id: string,
  project: string,
  overrides: Partial<AgentProjectThreadInput> = {},
): TestThread {
  return {
    id,
    project,
    agentSessionStatus: "ready",
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    runtime: null,
    archivedAt: null,
    settledOverride: null,
    keepAgentOnAt: null,
    ...overrides,
  };
}

describe("resolveThreadAgentState", () => {
  it("is none without a session and offline once it stopped or failed", () => {
    expect(resolveThreadAgentState(thread("a", "p", { agentSessionStatus: null }))).toBe("none");
    expect(resolveThreadAgentState(thread("a", "p", { agentSessionStatus: "stopped" }))).toBe(
      "offline",
    );
    expect(resolveThreadAgentState(thread("a", "p", { agentSessionStatus: "error" }))).toBe(
      "offline",
    );
  });

  it("needs you on a pending approval or question, ahead of working", () => {
    expect(
      resolveThreadAgentState(
        thread("a", "p", { hasPendingApprovals: true, runtime: { status: "running" } }),
      ),
    ).toBe("needs-you");
    expect(resolveThreadAgentState(thread("a", "p", { hasPendingUserInput: true }))).toBe(
      "needs-you",
    );
  });

  it("is working during a run and idle otherwise", () => {
    expect(resolveThreadAgentState(thread("a", "p", { runtime: { status: "running" } }))).toBe(
      "working",
    );
    expect(resolveThreadAgentState(thread("a", "p", { runtime: { status: "idle" } }))).toBe("idle");
    expect(resolveThreadAgentState(thread("a", "p"))).toBe("idle");
  });

  it("counts only live agents as active", () => {
    expect(threadAgentIsActive("working")).toBe(true);
    expect(threadAgentIsActive("needs-you")).toBe(true);
    expect(threadAgentIsActive("idle")).toBe(true);
    expect(threadAgentIsActive("offline")).toBe(false);
    expect(threadAgentIsActive("none")).toBe(false);
  });
});

describe("summarizeAgentProjects", () => {
  const projectOf = (t: TestThread) =>
    t.project === "unlisted"
      ? undefined
      : { projectKey: t.project, displayName: t.project.toUpperCase() };

  it("counts live agents per project, needing-you first, then most active", () => {
    const summaries = summarizeAgentProjects({
      threads: [
        thread("1", "wush"),
        thread("2", "wush", { runtime: { status: "running" } }),
        thread("3", "lexie", { hasPendingApprovals: true }),
        thread("4", "howsitgoing"),
        thread("5", "howsitgoing", { agentSessionStatus: null }),
        thread("6", "unlisted"),
      ],
      projectOf,
    });
    expect(summaries.map((s) => [s.projectKey, s.displayName, s.active, s.needsYou])).toEqual([
      ["lexie", "LEXIE", 1, 1],
      ["wush", "WUSH", 2, 0],
      ["howsitgoing", "HOWSITGOING", 1, 0],
    ]);
  });

  it("skips archived and settled threads", () => {
    const summaries = summarizeAgentProjects({
      threads: [
        thread("1", "wush", { archivedAt: "2026-10-01T00:00:00.000Z" }),
        thread("2", "wush", { settledOverride: "settled" }),
      ],
      projectOf,
    });
    expect(summaries).toEqual([]);
  });

  it("keeps the first offline kept-on agent without counting it as active", () => {
    const first = thread("1", "playvesting", {
      agentSessionStatus: "stopped",
      keepAgentOnAt: "2026-10-01T00:00:00.000Z",
    });
    const second = thread("2", "playvesting", {
      agentSessionStatus: "stopped",
      keepAgentOnAt: "2026-10-02T00:00:00.000Z",
    });
    const notKept = thread("3", "lexie", { agentSessionStatus: "stopped" });
    const [summary, ...rest] = summarizeAgentProjects({
      threads: [first, second, notKept],
      projectOf,
    });
    expect(rest).toEqual([]);
    expect(summary).toMatchObject({ projectKey: "playvesting", active: 0, needsYou: 0 });
    expect(summary?.offlineKeptOn?.id).toBe("1");
  });
});
