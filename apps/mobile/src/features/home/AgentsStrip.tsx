import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import type { AgentProjectSummary } from "@t3tools/client-runtime/state/thread-agent";
import { MessageId } from "@t3tools/contracts";
import { resolveProjectSettings } from "@t3tools/shared/projectSettings";
import { GlassView } from "expo-glass-effect";
import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { withUniwind } from "uniwind";

import { AppText as Text } from "../../components/AppText";
import { cn } from "../../lib/cn";
import { uuidv4 } from "../../lib/uuid";
import { NATIVE_LIQUID_GLASS_SUPPORTED } from "../../native/native-glass";
import { useServerConfigs } from "../../state/entities";
import { threadEnvironment } from "../../state/threads";
import { useAtomCommand } from "../../state/use-atom-command";
import { useAppearancePreferences } from "../settings/appearance/AppearancePreferencesProvider";

const ChipGlass = withUniwind(GlassView, {
  style: { fromClassName: "className" },
  tintColor: { fromClassName: "tintColorClassName", styleProperty: "accentColor" },
});

// Matches ListFilterMenu's pills so the two rows read as one filter area.
const PILL = "h-8 flex-row items-center gap-1.5 rounded-full px-3";

export type AgentsStripProject = AgentProjectSummary<EnvironmentThreadShell>;

/**
 * Below the filter row: projects with live agents, needing-you first. Tapping
 * a chip scopes the list to that project; tapping the scoped one clears it.
 * A project whose only agent is kept on but offline offers a Nudge instead.
 */
export function AgentsStrip(props: {
  readonly projects: ReadonlyArray<AgentsStripProject>;
  readonly selectedProjectKey: string | null;
  readonly onProjectChange: (projectKey: string | null) => void;
}) {
  if (props.projects.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel="Projects with active agents"
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 10, gap: 8 }}
    >
      {props.projects.map((project) => {
        if (project.active === 0 && project.offlineKeptOn !== null) {
          return (
            <View
              key={project.projectKey}
              className={cn(PILL, "border border-dashed border-foreground-tertiary")}
            >
              <View className="size-1.5 rounded-full border border-dashed border-foreground-tertiary" />
              <Text numberOfLines={1} className="max-w-[160px] text-sm text-foreground-muted">
                {project.displayName} · offline
              </Text>
              <NudgeAgentButton thread={project.offlineKeptOn} />
            </View>
          );
        }
        const selected = project.projectKey === props.selectedProjectKey;
        const label = `${project.displayName}, ${project.active} active agent${
          project.active === 1 ? "" : "s"
        }${project.needsYou > 0 ? `, ${project.needsYou} needing you` : ""}`;
        return (
          <Pressable
            key={project.projectKey}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected }}
            hitSlop={6}
            onPress={() => props.onProjectChange(selected ? null : project.projectKey)}
          >
            <ChipSurface active={selected}>
              <View
                className={cn(
                  "size-1.5 rounded-full",
                  project.needsYou > 0 ? "bg-amber-500" : "bg-emerald-500",
                )}
              />
              <Text
                numberOfLines={1}
                className={cn(
                  "max-w-[160px] text-sm font-t3-medium",
                  selected ? "text-primary-foreground" : "text-foreground-muted",
                )}
              >
                {project.displayName}
              </Text>
              <Text
                className={cn(
                  "text-sm tabular-nums",
                  selected ? "text-primary-foreground" : "text-foreground-tertiary",
                )}
              >
                {project.active}
              </Text>
            </ChipSurface>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function ChipSurface(props: { readonly active: boolean; readonly children: ReactNode }) {
  const { themeAppearance } = useAppearancePreferences();
  if (NATIVE_LIQUID_GLASS_SUPPORTED) {
    return (
      <ChipGlass
        isInteractive
        colorScheme={themeAppearance}
        tintColorClassName={props.active ? "accent-primary" : undefined}
        className={PILL}
      >
        {props.children}
      </ChipGlass>
    );
  }
  return (
    <View className={cn(PILL, props.active ? "bg-primary" : "bg-subtle")}>{props.children}</View>
  );
}

/**
 * Brings an offline kept-on agent back by sending its project's nudge message
 * (project settings → Nudge message) as a new turn, which restarts its session.
 */
function NudgeAgentButton(props: { readonly thread: EnvironmentThreadShell }) {
  const { thread } = props;
  const serverConfig = useServerConfigs().get(thread.environmentId);
  const startTurn = useAtomCommand(threadEnvironment.startTurn, "nudge agent");
  const [sending, setSending] = useState(false);
  if (serverConfig === undefined) return null;
  const text = resolveProjectSettings(serverConfig.settings, thread.projectId).settings
    .agentNudgePrompt;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Nudge the offline agent"
      disabled={sending}
      hitSlop={8}
      onPress={async () => {
        setSending(true);
        await startTurn({
          environmentId: thread.environmentId,
          input: {
            threadId: thread.id,
            message: {
              messageId: MessageId.make(uuidv4()),
              role: "user",
              text,
              attachments: [],
            },
            runtimeMode: thread.runtimeMode,
            interactionMode: thread.interactionMode,
            dispatchMode: "start",
          },
        });
        setSending(false);
      }}
    >
      <Text className={cn("text-sm font-t3-medium text-primary", sending && "opacity-50")}>
        {sending ? "Nudging…" : "Nudge"}
      </Text>
    </Pressable>
  );
}
