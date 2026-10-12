import { describe, expect, it } from "@effect/vitest";

import {
  matchesThreadAgentName,
  threadAgentHandle,
  threadAgentIsOnline,
  threadAgentName,
} from "./threadAgent.ts";

describe("threadAgent", () => {
  it("names an agent from its project and thread title", () => {
    expect(threadAgentName("howsitgoing", "Build the iOS App")).toBe(
      "howsitgoing/build-the-ios-app",
    );
    expect(threadAgentName("Café Débuts", "Fix: login (again!)")).toBe(
      "cafe-debuts/fix-login-again",
    );
    expect(threadAgentHandle("!!!")).toBe("thread");
    expect(threadAgentHandle("x".repeat(80))).toHaveLength(40);
  });

  it("matches a name with or without the project and @", () => {
    expect(matchesThreadAgentName("@howsitgoing/build-the-ios-app", "Build the iOS App")).toBe(
      true,
    );
    expect(matchesThreadAgentName("build-the-ios-app", "Build the iOS App")).toBe(true);
    expect(matchesThreadAgentName("other/build-the-ios-app", "Build the iOS App")).toBe(true);
    expect(matchesThreadAgentName("build-the-android-app", "Build the iOS App")).toBe(false);
    expect(matchesThreadAgentName("", "Build the iOS App")).toBe(false);
  });

  it("treats a starting, ready, running or waiting session as online", () => {
    expect(
      ["starting", "ready", "running", "waiting"].every((s) => threadAgentIsOnline(s as never)),
    ).toBe(true);
    expect(threadAgentIsOnline("stopped")).toBe(false);
    expect(threadAgentIsOnline(null)).toBe(false);
  });
});
