import type { EnvironmentThreadShell } from "./models.ts";
import type { AgentProjectSummary } from "./threadAgent.ts";

type ThreadNeedsUserInput = Pick<
  EnvironmentThreadShell,
  "hasPendingApprovals" | "hasPendingUserInput" | "runtime"
>;

/** A pending approval or question, or a run stopped by an error or a limit. */
export function threadNeedsUser(thread: ThreadNeedsUserInput): boolean {
  return (
    thread.hasPendingApprovals || thread.hasPendingUserInput || thread.runtime?.status === "failed"
  );
}

/**
 * Project keys, other than the selected one, holding a live thread that needs
 * the user. Project pills use it to flag work the current scope hides; settled,
 * archived and subagent threads never raise the mark. Callers map threads to their own
 * project grouping through `projectKeyOf`.
 */
export function projectKeysNeedingUser<
  T extends ThreadNeedsUserInput &
    Pick<EnvironmentThreadShell, "archivedAt" | "settledOverride" | "lineage">,
>(input: {
  readonly threads: Iterable<T>;
  readonly projectKeyOf: (thread: T) => string | undefined;
  readonly selectedProjectKey: string | null;
}): Set<string> {
  const keys = new Set<string>();
  for (const thread of input.threads) {
    if (thread.archivedAt !== null || thread.settledOverride === "settled") continue;
    if (thread.lineage.relationshipToParent === "subagent") continue;
    if (!threadNeedsUser(thread)) continue;
    const projectKey = input.projectKeyOf(thread);
    if (projectKey !== undefined && projectKey !== input.selectedProjectKey) keys.add(projectKey);
  }
  return keys;
}

export type ProjectPillDot = "needs-you" | "working" | "offline";

/**
 * What a project pill shows: one dot (needs-you beats working beats an offline
 * kept-on agent) and its live agent count. `hiddenNeedsUser` is the
 * `projectKeysNeedingUser` mark; `agents` is the project's
 * `summarizeAgentProjects` entry, if it has one.
 */
export function projectPillStatus(input: {
  readonly hiddenNeedsUser: boolean;
  readonly agents:
    | Pick<AgentProjectSummary<unknown>, "active" | "needsYou" | "offlineKeptOn">
    | undefined;
}): { readonly dot: ProjectPillDot | null; readonly active: number } {
  const active = input.agents?.active ?? 0;
  if (input.hiddenNeedsUser || (input.agents?.needsYou ?? 0) > 0) {
    return { dot: "needs-you", active };
  }
  if (active > 0) return { dot: "working", active };
  if (input.agents?.offlineKeptOn != null) return { dot: "offline", active };
  return { dot: null, active };
}
