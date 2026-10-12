/**
 * The agent working in a thread, as other agents and the user address it: the
 * project and the thread title as slugs, e.g. "my-app/fix-login-flow". Derived,
 * not stored, so renaming the thread renames its agent.
 */
const slug = (value: string, max: number) =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/g, "") || "thread";

/** The thread part of an agent name: unique enough within one project. */
export function threadAgentHandle(threadTitle: string): string {
  return slug(threadTitle, 40);
}

export function threadAgentName(projectName: string, threadTitle: string): string {
  return `${slug(projectName, 30)}/${threadAgentHandle(threadTitle)}`;
}

/** Whether `name` ("project/handle" or just "handle") names this thread's agent. */
export function matchesThreadAgentName(name: string, threadTitle: string): boolean {
  const handle = name.trim().toLowerCase().replace(/^@/, "").split("/").at(-1) ?? "";
  return handle !== "" && handle === threadAgentHandle(threadTitle);
}

export type ThreadAgentSessionStatus =
  | "starting"
  | "ready"
  | "running"
  | "waiting"
  | "stopped"
  | "error";

/** A thread has a live agent while its provider session is up. */
export function threadAgentIsOnline(status: ThreadAgentSessionStatus | null | undefined): boolean {
  return (
    status === "starting" || status === "ready" || status === "running" || status === "waiting"
  );
}
