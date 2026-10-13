import { assert, it } from "@effect/vitest";
import * as Schema from "effect/Schema";

import {
  type ThreadBadge,
  ThreadBadgeInput,
  threadBadgeNeedsYou,
  visibleThreadBadges,
} from "./threadBadge.ts";

const NOW = Date.parse("2026-10-10T12:00:00.000Z");
const badge = (overrides: Partial<ThreadBadge>): ThreadBadge => ({
  key: "tasks",
  source: "Tracker",
  updatedAt: "2026-10-10T11:00:00.000Z",
  ...overrides,
});

it("hides zero counts and expired badges", () => {
  const visible = visibleThreadBadges(
    [
      badge({ key: "open", count: 2 }),
      badge({ key: "done", count: 0 }),
      badge({ key: "old", label: "old", expiresAt: "2026-10-10T11:59:00.000Z" }),
      badge({ key: "fresh", label: "new", expiresAt: "2026-10-10T12:01:00.000Z" }),
    ],
    NOW,
  );
  assert.deepStrictEqual(
    visible.map((item) => item.key),
    ["open", "fresh"],
  );
});

it("reports the first visible needs-you reason with its source", () => {
  assert.isNull(threadBadgeNeedsYou(undefined, NOW));
  assert.isNull(threadBadgeNeedsYou([badge({ count: 0, needsYou: "nothing left" })], NOW));
  assert.deepStrictEqual(threadBadgeNeedsYou([badge({ count: 2, needsYou: "2 to check" })], NOW), {
    reason: "2 to check",
    source: "Tracker",
  });
});

it("accepts only http(s) and t3code links and simple keys", () => {
  const decode = Schema.decodeUnknownSync(ThreadBadgeInput);
  assert.doesNotThrow(() => decode({ key: "tasks", url: "https://example.com/f/a-1" }));
  assert.doesNotThrow(() => decode({ key: "tasks.open", url: "t3code://threads/a/b" }));
  assert.throws(() => decode({ key: "tasks", url: "javascript:alert(1)" }));
  assert.throws(() => decode({ key: "tasks", url: "file:///etc/passwd" }));
  assert.throws(() => decode({ key: "Has Spaces" }));
  assert.throws(() => decode({ key: "tasks", count: -1 }));
});
