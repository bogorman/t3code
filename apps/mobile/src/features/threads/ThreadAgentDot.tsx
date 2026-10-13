import type { ThreadAgentState } from "@t3tools/client-runtime/state/thread-agent";
import { View } from "react-native";

import { cn } from "../../lib/cn";

export const THREAD_AGENT_STATE_LABELS: Record<ThreadAgentState, string> = {
  working: "Working",
  "needs-you": "Needs you",
  idle: "Idle",
  offline: "Offline",
  none: "No agent",
};

const DOT_CLASS_NAMES: Record<Exclude<ThreadAgentState, "none">, string> = {
  working: "bg-emerald-500",
  "needs-you": "bg-amber-500",
  idle: "bg-foreground-tertiary",
  offline: "border border-dashed border-foreground-tertiary",
};

/**
 * The thread's agent state as a small dot on the provider icon. Static on
 * purpose: a pulsing dot per working row would keep the list repainting.
 * `surfaceColor` is the row background, drawn as a ring so the dot reads
 * against the icon.
 */
export function ThreadAgentDot(props: {
  readonly state: ThreadAgentState;
  readonly surfaceColor: string;
  /** Inline (in a chip) instead of pinned to an icon's corner. */
  readonly inline?: boolean;
}) {
  if (props.state === "none") return null;
  const offline = props.state === "offline";
  return (
    <View
      accessible
      accessibilityLabel={`Agent: ${THREAD_AGENT_STATE_LABELS[props.state]}`}
      pointerEvents="none"
      className={props.inline ? undefined : "absolute -right-1 -bottom-1"}
      style={{
        padding: props.inline ? 0 : 1.5,
        borderRadius: 999,
        backgroundColor: props.inline ? undefined : props.surfaceColor,
      }}
    >
      <View
        className={cn("size-1.5 rounded-full", DOT_CLASS_NAMES[props.state])}
        style={offline ? { backgroundColor: props.surfaceColor } : undefined}
      />
    </View>
  );
}
