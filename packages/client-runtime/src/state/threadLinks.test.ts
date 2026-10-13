import { describe, expect, it } from "vite-plus/test";
import { groupLinkedThreads, planThreadLink, threadLinkPositions } from "./threadLinks.ts";

const thread = (id: string, linkGroupId: string | null = null, environmentId = "env") => ({
  id,
  environmentId,
  linkGroupId,
});
const ids = (threads: ReadonlyArray<{ id: string }>) => threads.map((entry) => entry.id);

describe("groupLinkedThreads", () => {
  it("moves later members up beneath the first member", () => {
    expect(
      ids(groupLinkedThreads([thread("a", "g"), thread("b"), thread("c"), thread("d", "g")])),
    ).toEqual(["a", "d", "b", "c"]);
  });

  it("leaves lone members and other environments in place", () => {
    const threads = [thread("a", "g"), thread("b"), thread("c", "g", "other"), thread("d", "h")];
    expect(groupLinkedThreads(threads)).toBe(threads);
  });
});

describe("threadLinkPositions", () => {
  it("marks runs of two or more within a section", () => {
    const positions = threadLinkPositions(
      [[thread("a", "g"), thread("b", "g"), thread("c", "g"), thread("d")], [thread("e", "g")]],
      (entry) => entry.id,
    );
    expect(Object.fromEntries(positions)).toEqual({ a: "first", b: "middle", c: "last" });
  });
});

describe("planThreadLink", () => {
  const fresh = () => "new";
  it("joins the target's group, moving the source out of its own", () => {
    expect(planThreadLink({ linkGroupId: "s" }, { linkGroupId: "t" }, fresh)).toEqual({
      linkGroupId: "t",
      linkTarget: false,
      linkSource: true,
    });
  });

  it("pulls an unlinked target into the source's group", () => {
    expect(planThreadLink({ linkGroupId: "s" }, { linkGroupId: null }, fresh)).toEqual({
      linkGroupId: "s",
      linkTarget: true,
      linkSource: false,
    });
  });

  it("makes a new group when neither is linked", () => {
    expect(planThreadLink({}, { linkGroupId: null }, fresh)).toEqual({
      linkGroupId: "new",
      linkTarget: true,
      linkSource: true,
    });
  });
});
