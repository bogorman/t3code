import { describe, expect, it } from "vite-plus/test";

import {
  projectKeysNeedingUser,
  projectPillStatus,
  threadNeedsUser,
} from "./projectsNeedingUser.ts";

type Runtime = { readonly status: string; readonly lastErrorClass?: string | null } | null;

function thread(input: {
  readonly project: string;
  readonly approval?: boolean;
  readonly question?: boolean;
  readonly runtime?: Runtime;
  readonly settled?: boolean;
  readonly archived?: boolean;
  readonly subagent?: boolean;
}) {
  return {
    project: input.project,
    hasPendingApprovals: input.approval ?? false,
    hasPendingUserInput: input.question ?? false,
    runtime: (input.runtime ?? null) as never,
    archivedAt: input.archived ? "2026-10-01T00:00:00.000Z" : null,
    settledOverride: input.settled ? ("settled" as const) : null,
    lineage: { relationshipToParent: input.subagent ? "subagent" : null } as never,
  };
}

describe("threadNeedsUser", () => {
  it("flags approvals, questions, failures and usage limits", () => {
    expect(threadNeedsUser(thread({ project: "a", approval: true }))).toBe(true);
    expect(threadNeedsUser(thread({ project: "a", question: true }))).toBe(true);
    expect(threadNeedsUser(thread({ project: "a", runtime: { status: "failed" } }))).toBe(true);
    expect(
      threadNeedsUser(
        thread({ project: "a", runtime: { status: "failed", lastErrorClass: "usage_limit" } }),
      ),
    ).toBe(true);
  });

  it("ignores working, waiting and idle threads", () => {
    expect(threadNeedsUser(thread({ project: "a" }))).toBe(false);
    expect(threadNeedsUser(thread({ project: "a", runtime: { status: "running" } }))).toBe(false);
    expect(threadNeedsUser(thread({ project: "a", runtime: { status: "idle" } }))).toBe(false);
    expect(threadNeedsUser(thread({ project: "a", runtime: { status: "completed" } }))).toBe(false);
  });
});

describe("projectKeysNeedingUser", () => {
  const projectKeyOf = (value: { readonly project: string }) =>
    value.project === "unknown" ? undefined : value.project;

  it("marks other projects with live threads needing the user", () => {
    const keys = projectKeysNeedingUser({
      threads: [
        thread({ project: "wush", approval: true }),
        thread({ project: "lexie", runtime: { status: "failed" } }),
        thread({ project: "playvesting", runtime: { status: "running" } }),
        thread({ project: "howsitgoing", question: true }),
        thread({ project: "unknown", approval: true }),
      ],
      projectKeyOf,
      selectedProjectKey: "howsitgoing",
    });
    expect([...keys].toSorted()).toEqual(["lexie", "wush"]);
  });

  it("skips settled, archived and subagent threads", () => {
    const keys = projectKeysNeedingUser({
      threads: [
        thread({ project: "wush", approval: true, settled: true }),
        thread({ project: "lexie", question: true, archived: true }),
        thread({ project: "playvesting", approval: true, subagent: true }),
      ],
      projectKeyOf,
      selectedProjectKey: null,
    });
    expect(keys.size).toBe(0);
  });
});

describe("projectPillStatus", () => {
  const agents = (active: number, needsYou = 0, offlineKeptOn: unknown = null) => ({
    active,
    needsYou,
    offlineKeptOn,
  });

  it("shows needs-you over working, with the live agent count", () => {
    expect(projectPillStatus({ hiddenNeedsUser: false, agents: agents(3, 1) })).toEqual({
      dot: "needs-you",
      active: 3,
    });
    expect(projectPillStatus({ hiddenNeedsUser: true, agents: agents(2) })).toEqual({
      dot: "needs-you",
      active: 2,
    });
    expect(projectPillStatus({ hiddenNeedsUser: false, agents: agents(2) })).toEqual({
      dot: "working",
      active: 2,
    });
  });

  it("marks an offline kept-on agent only when nothing is live", () => {
    expect(projectPillStatus({ hiddenNeedsUser: false, agents: agents(0, 0, {}) })).toEqual({
      dot: "offline",
      active: 0,
    });
    expect(projectPillStatus({ hiddenNeedsUser: false, agents: undefined })).toEqual({
      dot: null,
      active: 0,
    });
  });
});
