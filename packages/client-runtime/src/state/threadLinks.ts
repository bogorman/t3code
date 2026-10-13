/** Thread link groups (TeaTree #9): threads sharing a `linkGroupId` in one
    environment sit together in thread lists. Shared by web and mobile. */

export type LinkableThread = {
  readonly id: string;
  readonly environmentId: string;
  readonly linkGroupId?: string | null;
};

/** Group identity across environments, or null for an unlinked thread. */
export const threadLinkGroupKey = (thread: LinkableThread): string | null =>
  thread.linkGroupId ? `${thread.environmentId}:${thread.linkGroupId}` : null;

/** Linked threads sit together: later members move up beneath the first
    member's slot, keeping their own relative order. A group with one member
    in the list is an ordinary row. Returns the input when nothing moves. */
export function groupLinkedThreads<T extends LinkableThread>(threads: readonly T[]): readonly T[] {
  const members = new Map<string, T[]>();
  for (const thread of threads) {
    const key = threadLinkGroupKey(thread);
    if (key === null) continue;
    const group = members.get(key);
    if (group) group.push(thread);
    else members.set(key, [thread]);
  }
  if (![...members.values()].some((group) => group.length > 1)) return threads;
  const placed = new Set<string>();
  const grouped: T[] = [];
  for (const thread of threads) {
    const key = threadLinkGroupKey(thread);
    const group = key === null ? undefined : members.get(key);
    if (key === null || group === undefined || group.length < 2) grouped.push(thread);
    else if (!placed.has(key)) {
      placed.add(key);
      grouped.push(...group);
    }
  }
  return grouped;
}

export type ThreadLinkPosition = "first" | "middle" | "last";

/** Where each row sits in a run of adjacent linked rows, by thread key. Rows
    outside a run of two or more are absent. Runs never cross sections. */
export function threadLinkPositions<T extends LinkableThread>(
  sections: ReadonlyArray<readonly T[]>,
  keyOf: (thread: T) => string,
): ReadonlyMap<string, ThreadLinkPosition> {
  const positions = new Map<string, ThreadLinkPosition>();
  for (const threads of sections) {
    let start = 0;
    for (let index = 1; index <= threads.length; index += 1) {
      const key = threadLinkGroupKey(threads[start]!);
      if (index < threads.length && key !== null && threadLinkGroupKey(threads[index]!) === key) {
        continue;
      }
      if (index - start > 1) {
        for (let member = start; member < index; member += 1) {
          positions.set(
            keyOf(threads[member]!),
            member === start ? "first" : member === index - 1 ? "last" : "middle",
          );
        }
      }
      start = index;
    }
  }
  return positions;
}

/** Linking `source` onto `target`: both end up in `linkGroupId`. Reuses the
    target's group, else the source's, else a fresh id. `linkTarget` and
    `linkSource` say which threads still need a `thread.link` command; send
    the target first so a new group never shows the source alone. */
export function planThreadLink(
  source: Pick<LinkableThread, "linkGroupId">,
  target: Pick<LinkableThread, "linkGroupId">,
  newGroupId: () => string,
): { readonly linkGroupId: string; readonly linkTarget: boolean; readonly linkSource: boolean } {
  const linkGroupId = target.linkGroupId || source.linkGroupId || newGroupId();
  return {
    linkGroupId,
    linkTarget: target.linkGroupId !== linkGroupId,
    linkSource: source.linkGroupId !== linkGroupId,
  };
}
