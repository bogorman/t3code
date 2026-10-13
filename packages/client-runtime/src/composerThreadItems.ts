import type { EnvironmentId, ScopedThreadRef, ThreadId } from "@t3tools/contracts";
import {
  type ThreadAgentSessionStatus,
  threadAgentHandle,
  threadAgentIsOnline,
} from "@t3tools/shared/threadAgent";

const COMPOSER_THREAD_RESULT_LIMIT = 5;

export interface ComposerThreadCandidate {
  readonly environmentId: EnvironmentId;
  readonly id: ThreadId;
  readonly title: string;
  readonly updatedAt: string;
  readonly archivedAt: string | null;
  /** The thread's agent (its provider session); live agents lead the list. */
  readonly agentSessionStatus?: ThreadAgentSessionStatus | null;
}

export interface ComposerThreadItem {
  readonly id: string;
  readonly type: "thread";
  readonly thread: ScopedThreadRef;
  readonly label: string;
  readonly description: string;
}

const AGENT_STATUS_LABELS: Record<ThreadAgentSessionStatus, string> = {
  starting: "starting",
  ready: "idle",
  running: "working",
  waiting: "waiting",
  stopped: "offline",
  error: "offline",
};

/**
 * Threads the `@` picker offers next to file paths. The agent can only read threads on its
 * own server, so candidates stay within the composer's environment. A query is required:
 * bare `@` stays a file picker. Matches the title or the agent name (its title slug, e.g.
 * `fix-login`); threads with a live agent lead, so one agent can be pointed at another.
 */
export function matchComposerThreadItems(input: {
  shells: ReadonlyArray<ComposerThreadCandidate>;
  environmentId: EnvironmentId;
  excludeThreadId: ThreadId | null;
  query: string;
}): ComposerThreadItem[] {
  const query = input.query.trim().toLowerCase();
  if (query.length === 0) return [];
  return input.shells
    .filter(
      (shell) =>
        shell.environmentId === input.environmentId &&
        shell.id !== input.excludeThreadId &&
        shell.archivedAt === null &&
        (shell.title.toLowerCase().includes(query) ||
          threadAgentHandle(shell.title).includes(query.replace(/^.*\//, ""))),
    )
    .sort(
      (left, right) =>
        Number(threadAgentIsOnline(right.agentSessionStatus)) -
          Number(threadAgentIsOnline(left.agentSessionStatus)) ||
        right.updatedAt.localeCompare(left.updatedAt),
    )
    .slice(0, COMPOSER_THREAD_RESULT_LIMIT)
    .map((shell) => ({
      id: `thread:${shell.environmentId}:${shell.id}`,
      type: "thread",
      thread: { environmentId: shell.environmentId, threadId: shell.id },
      label: shell.title,
      description:
        shell.agentSessionStatus == null
          ? "Thread"
          : `Agent ${threadAgentHandle(shell.title)} · ${AGENT_STATUS_LABELS[shell.agentSessionStatus]}`,
    }));
}
