import { threadAgentIsOnline } from "@t3tools/shared/threadAgent";

import type { EnvironmentThreadShell } from "./models.ts";

/**
 * The thread's agent, from its provider session: working on a turn, waiting on
 * the user (an approval or a question), idle at its prompt, offline (session
 * stopped or failed), or none (no session attached).
 */
export type ThreadAgentState = "working" | "needs-you" | "idle" | "offline" | "none";

export type ThreadAgentStateInput = Pick<
  EnvironmentThreadShell,
  "agentSessionStatus" | "hasPendingApprovals" | "hasPendingUserInput"
> & {
  readonly runtime: Pick<NonNullable<EnvironmentThreadShell["runtime"]>, "status"> | null;
};

const WORKING_RUNTIME_STATUSES = new Set(["preparing", "queued", "starting", "running", "waiting"]);

export function resolveThreadAgentState(thread: ThreadAgentStateInput): ThreadAgentState {
  if (thread.agentSessionStatus === null) return "none";
  if (!threadAgentIsOnline(thread.agentSessionStatus)) return "offline";
  if (thread.hasPendingApprovals || thread.hasPendingUserInput) return "needs-you";
  if (thread.runtime !== null && WORKING_RUNTIME_STATUSES.has(thread.runtime.status)) {
    return "working";
  }
  return "idle";
}

/** A live agent: its session is up, whatever it is doing. */
export function threadAgentIsActive(state: ThreadAgentState): boolean {
  return state === "working" || state === "needs-you" || state === "idle";
}

export type AgentProjectThreadInput = ThreadAgentStateInput &
  Pick<EnvironmentThreadShell, "archivedAt" | "settledOverride" | "keepAgentOnAt">;

export interface AgentProjectSummary<TThread> {
  readonly projectKey: string;
  readonly displayName: string;
  /** Threads in this project with a live agent. */
  readonly active: number;
  /** Live agents waiting on an approval or a question. */
  readonly needsYou: number;
  /** The first kept-on agent in this project that is offline, to nudge. */
  readonly offlineKeptOn: TThread | null;
}

/**
 * Projects with live agents (or an offline kept-on one), needing-you first,
 * then most active. Archived and settled threads are skipped. `projectOf`
 * maps a thread to the project group it is listed under, or undefined to skip it.
 */
export function summarizeAgentProjects<TThread extends AgentProjectThreadInput>(input: {
  readonly threads: Iterable<TThread>;
  readonly projectOf: (
    thread: TThread,
  ) => { readonly projectKey: string; readonly displayName: string } | undefined;
}): AgentProjectSummary<TThread>[] {
  const summaries = new Map<
    string,
    { displayName: string; active: number; needsYou: number; offlineKeptOn: TThread | null }
  >();
  for (const thread of input.threads) {
    if (thread.archivedAt !== null || thread.settledOverride === "settled") continue;
    const state = resolveThreadAgentState(thread);
    const offlineKeptOn = state === "offline" && thread.keepAgentOnAt != null;
    if (!threadAgentIsActive(state) && !offlineKeptOn) continue;
    const project = input.projectOf(thread);
    if (project === undefined) continue;
    let summary = summaries.get(project.projectKey);
    if (summary === undefined) {
      summary = { displayName: project.displayName, active: 0, needsYou: 0, offlineKeptOn: null };
      summaries.set(project.projectKey, summary);
    }
    if (offlineKeptOn) {
      summary.offlineKeptOn ??= thread;
      continue;
    }
    summary.active += 1;
    if (state === "needs-you") summary.needsYou += 1;
  }
  return [...summaries.entries()]
    .map(([projectKey, summary]) => ({ projectKey, ...summary }))
    .sort((a, b) => b.needsYou - a.needsYou || b.active - a.active);
}
