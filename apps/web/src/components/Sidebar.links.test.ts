import type { CollisionDetection } from "@dnd-kit/core";
import { describe, expect, it } from "vite-plus/test";
import { sidebarLinkTargetOf, withSidebarLinkTarget } from "./Sidebar.drag";
import { sidebarDropKeepsLink } from "./Sidebar.logic";

const thread = (id: string, linkGroupId: string | null = null, environmentId = "env") => ({
  id,
  environmentId,
  linkGroupId,
});

describe("sidebarDropKeepsLink", () => {
  const byKey = new Map(
    [thread("a", "g"), thread("b", "g"), thread("c")].map((entry) => [entry.id, entry]),
  );
  it("keeps the link beside a group member and drops it elsewhere", () => {
    expect(sidebarDropKeepsLink(["a", "b", "c"], "b", byKey)).toBe(true);
    expect(sidebarDropKeepsLink(["a", "c", "b"], "b", byKey)).toBe(false);
  });
});

describe("withSidebarLinkTarget", () => {
  const rowAt = (id: string, top: number) => ({
    id,
    top,
    rect: { top, bottom: top + 80, left: 0, right: 200, width: 200, height: 80 },
  });
  const rows = [rowAt("a", 0), rowAt("b", 80), rowAt("c", 160)];
  const detectAt = (y: number, canLink = (id: string) => id !== "c") =>
    withSidebarLinkTarget(
      () => [{ id: "fallback" }],
      canLink,
    )({
      active: { id: "a" },
      pointerCoordinates: { x: 100, y },
      droppableContainers: rows.map((row) => ({ id: row.id })),
      droppableRects: new Map(rows.map((row) => [row.id, row.rect])),
    } as unknown as Parameters<CollisionDetection>[0]);

  it("links over the middle half of another row and reorders near its edges", () => {
    expect(sidebarLinkTargetOf(detectAt(120))).toBe("b");
    expect(detectAt(120)[0]?.id).toBe("a");
    expect(sidebarLinkTargetOf(detectAt(85))).toBeNull();
    expect(detectAt(155)[0]?.id).toBe("fallback");
  });

  it("ignores the lifted row and rows that cannot link", () => {
    expect(detectAt(40)[0]?.id).toBe("fallback");
    expect(detectAt(200)[0]?.id).toBe("fallback");
  });
});
