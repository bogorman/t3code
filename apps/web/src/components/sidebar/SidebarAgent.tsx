import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { resolveProjectSettings } from "@t3tools/shared/projectSettings";
import { CopyIcon } from "lucide-react";
import { useState } from "react";

import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";
import { useEnvironmentSettings } from "../../hooks/useSettings";
import { newMessageId } from "../../lib/utils";
import { threadEnvironment } from "../../state/threads";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { cn } from "../../lib/utils";
import type { SidebarAgentState } from "../Sidebar.logic";

const STATE_LABELS: Record<SidebarAgentState, string> = {
  working: "Working",
  "needs-you": "Needs you",
  idle: "Idle, at its prompt",
  offline: "Offline",
  none: "No agent",
};

const STATE_DOT: Record<SidebarAgentState, string> = {
  working: "bg-success",
  "needs-you": "bg-warning",
  idle: "bg-muted-foreground",
  offline: "border border-dashed border-muted-foreground bg-transparent",
  none: "hidden",
};

/** A small dot on the provider icon: the thread's agent state. */
export function SidebarAgentDot(props: { state: SidebarAgentState; className?: string }) {
  if (props.state === "none") return null;
  return (
    <span
      aria-label={`Agent: ${STATE_LABELS[props.state]}`}
      data-agent-state={props.state}
      className={cn(
        "pointer-events-none absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full ring-1 ring-background",
        STATE_DOT[props.state],
        props.state === "working" && "motion-safe:animate-status-pulse",
        props.className,
      )}
    />
  );
}

/** The hover card's agent line: its name (to address it from another agent) and state. */
export function SidebarAgentDetails(props: {
  name: string;
  state: SidebarAgentState;
  keptOn?: boolean;
  thread?: NudgeableThread;
}) {
  const { copyToClipboard, isCopied } = useCopyToClipboard();
  if (props.state === "none") return null;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="relative inline-flex size-3 shrink-0 items-center justify-center">
        <SidebarAgentDot state={props.state} className="static size-2 ring-0" />
      </span>
      <div className="min-w-0 flex-1 truncate">
        <span className="font-mono text-foreground/85">{props.name}</span>
        <span className="text-muted-foreground"> · {STATE_LABELS[props.state]}</span>
        {props.keptOn ? <span className="text-muted-foreground"> · kept on</span> : null}
      </div>
      {props.state === "offline" && props.thread ? (
        <NudgeAgentButton thread={props.thread} />
      ) : null}
      <button
        type="button"
        aria-label="Copy agent name"
        className="shrink-0 text-muted-foreground hover:text-foreground"
        onClick={(event) => {
          event.stopPropagation();
          copyToClipboard(`@${props.name}`);
        }}
      >
        {isCopied ? <span className="text-xs">Copied</span> : <CopyIcon className="size-3" />}
      </button>
    </div>
  );
}

export interface SidebarAgentProjectSummary {
  readonly projectKey: string;
  readonly displayName: string;
  readonly active: number;
  readonly needsYou: number;
  /** A kept-on agent in this project that is offline, to nudge from the strip. */
  readonly offlineKeptOn: NudgeableThread | null;
}

/** Above the thread list: the projects with live agents, needing-you first. Click filters to it. */
export function SidebarAgentStrip(props: {
  projects: ReadonlyArray<SidebarAgentProjectSummary>;
  selectedProjectKey: string | null;
  onSelect: (projectKey: string | null) => void;
}) {
  if (props.projects.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 px-2 pt-1.5" aria-label="Projects with active agents">
      {props.projects.map((project) => {
        const selected = project.projectKey === props.selectedProjectKey;
        if (project.active === 0 && project.offlineKeptOn !== null) {
          return (
            <span
              key={project.projectKey}
              title="Its kept-on agent is offline"
              className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-dashed border-muted-foreground/40 px-2 py-0.5 text-xs text-muted-foreground"
            >
              <span className="size-1.5 shrink-0 rounded-full border border-dashed border-muted-foreground" />
              <span className="truncate">{project.displayName} · offline</span>
              <NudgeAgentButton thread={project.offlineKeptOn} />
            </span>
          );
        }
        return (
          <button
            key={project.projectKey}
            type="button"
            onClick={() => props.onSelect(selected ? null : project.projectKey)}
            title={`${project.active} active agent${project.active === 1 ? "" : "s"}${
              project.needsYou > 0 ? `, ${project.needsYou} needing you` : ""
            }`}
            className={cn(
              "inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-xs",
              selected
                ? "bg-accent text-foreground"
                : "bg-muted/60 text-muted-foreground hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                project.needsYou > 0 ? "bg-warning" : "bg-success",
              )}
            />
            <span className="truncate">{project.displayName}</span>
            <span className="tabular-nums opacity-70">{project.active}</span>
          </button>
        );
      })}
    </div>
  );
}

type NudgeableThread = Pick<
  EnvironmentThreadShell,
  "environmentId" | "projectId" | "id" | "runtimeMode" | "interactionMode"
>;

/**
 * Brings an offline agent back: sends its project's nudge message (Settings →
 * Thread behavior → Nudge message), which starts its session again.
 */
export function NudgeAgentButton(props: { thread: NudgeableThread; className?: string }) {
  const text = useEnvironmentSettings(
    props.thread.environmentId,
    (settings) =>
      resolveProjectSettings(settings, props.thread.projectId).settings.agentNudgePrompt,
  );
  const startTurn = useOrchestrationCommand(threadEnvironment.startTurn, { reportFailure: false });
  const [sending, setSending] = useState(false);
  return (
    <button
      type="button"
      disabled={sending}
      className={cn(
        "shrink-0 text-xs text-info hover:underline disabled:opacity-50",
        props.className,
      )}
      onClick={async (event) => {
        event.stopPropagation();
        setSending(true);
        const result = await startTurn({
          environmentId: props.thread.environmentId,
          input: {
            threadId: props.thread.id,
            message: { messageId: newMessageId(), role: "user", text, attachments: [] },
            runtimeMode: props.thread.runtimeMode,
            interactionMode: props.thread.interactionMode,
            dispatchMode: "start",
          },
        });
        setSending(false);
        if (result._tag === "Failure") {
          toastManager.add(
            stackedThreadToast({ type: "error", title: "Could not nudge the agent" }),
          );
        }
      }}
    >
      {sending ? "Nudging…" : "Nudge"}
    </button>
  );
}
