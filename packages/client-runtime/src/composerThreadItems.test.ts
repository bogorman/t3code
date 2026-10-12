import { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { matchComposerThreadItems } from "./composerThreadItems.ts";

const env = EnvironmentId.make("env-1");
const otherEnv = EnvironmentId.make("env-2");
const shell = (
  id: string,
  title: string,
  overrides: Partial<Parameters<typeof matchComposerThreadItems>[0]["shells"][number]> = {},
) => ({
  environmentId: env,
  id: ThreadId.make(id),
  title,
  updatedAt: "2026-01-01T00:00:00.000Z",
  archivedAt: null,
  ...overrides,
});

describe("matchComposerThreadItems", () => {
  it("offers nothing for a bare @ so the picker stays a file picker", () => {
    expect(
      matchComposerThreadItems({
        shells: [shell("t1", "Fix login")],
        environmentId: env,
        excludeThreadId: null,
        query: "  ",
      }),
    ).toEqual([]);
  });

  it("matches titles within the environment, newest first, skipping self and archived", () => {
    const items = matchComposerThreadItems({
      shells: [
        shell("old", "Login flow", { updatedAt: "2026-01-01T00:00:00.000Z" }),
        shell("new", "Login redesign", { updatedAt: "2026-02-01T00:00:00.000Z" }),
        shell("self", "Login self"),
        shell("gone", "Login archived", { archivedAt: "2026-01-02T00:00:00.000Z" }),
        shell("foreign", "Login elsewhere", { environmentId: otherEnv }),
        shell("nope", "Unrelated"),
      ],
      environmentId: env,
      excludeThreadId: ThreadId.make("self"),
      query: "LOGIN",
    });
    expect(items.map((item) => item.thread.threadId)).toEqual(["new", "old"]);
    expect(items[0]).toMatchObject({ type: "thread", label: "Login redesign" });
  });

  it("matches agent names, labels agent state, and puts live agents first", () => {
    const items = matchComposerThreadItems({
      shells: [
        shell("t1", "Fix login flow", { updatedAt: "2026-01-02T00:00:00.000Z" }),
        shell("t2", "Fix login tests", { agentSessionStatus: "running" }),
        shell("t3", "Fix login docs", { agentSessionStatus: "stopped" }),
      ],
      environmentId: env,
      excludeThreadId: null,
      query: "fix-login",
    });
    expect(items.map((item) => [item.label, item.description])).toEqual([
      ["Fix login tests", "Agent fix-login-tests · working"],
      ["Fix login flow", "Thread"],
      ["Fix login docs", "Agent fix-login-docs · offline"],
    ]);
    expect(
      matchComposerThreadItems({
        shells: [shell("t2", "Fix login tests", { agentSessionStatus: "ready" })],
        environmentId: env,
        excludeThreadId: null,
        query: "my-app/fix-login-tests",
      }),
    ).toHaveLength(1);
  });
});
