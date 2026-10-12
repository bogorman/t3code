import { DEFAULT_AGENT_NUDGE_PROMPT } from "@t3tools/contracts";
import { useRef } from "react";

import { Textarea } from "../ui/textarea";
import { SettingsRow, SettingResetButton } from "./settingsLayout";
import { useSettingsScope } from "./SettingsScopeContext";
import { searchableSetting } from "./settingsSearch";
import {
  useScopedSettings,
  useScopedSettingsMixed,
  useUpdateScopedSettings,
} from "./useScopedSettings";

/** The message that brings a kept-on agent back when it goes offline (thread menu → Keep agent on). */
export function AgentNudgeSettings() {
  const settings = useScopedSettings();
  const { targets } = useSettingsScope();
  const scopeKey = targets.map((target) => `${target.environmentId}:${target.projectId}`).join(",");
  const edited = useRef(false);
  const updateSettings = useUpdateScopedSettings();
  const mixed = useScopedSettingsMixed(["agentNudgePrompt"]);

  return (
    <SettingsRow
      serverScoped
      settingKeys={["agentNudgePrompt"]}
      {...searchableSetting("agent-nudge-prompt")}
      description="Sent to a thread whose agent you keep on (thread menu → Keep agent on) when it goes offline, and by the Nudge button. It starts the agent again."
      resetAction={
        mixed || settings.agentNudgePrompt !== DEFAULT_AGENT_NUDGE_PROMPT ? (
          <SettingResetButton
            label="nudge message"
            onClick={() => updateSettings({ agentNudgePrompt: DEFAULT_AGENT_NUDGE_PROMPT })}
          />
        ) : null
      }
    >
      <div className="mt-3 max-w-2xl pb-3.5">
        <Textarea
          key={`${scopeKey}:${mixed}:${settings.agentNudgePrompt}`}
          aria-label="Nudge message"
          onChange={() => {
            edited.current = true;
          }}
          rows={3}
          defaultValue={mixed ? "" : settings.agentNudgePrompt}
          placeholder={
            mixed
              ? "Mixed. Enter a message to apply to all selected targets."
              : DEFAULT_AGENT_NUDGE_PROMPT
          }
          onBlur={(event) => {
            const value = event.target.value.trim() || DEFAULT_AGENT_NUDGE_PROMPT;
            if (edited.current && (mixed || value !== settings.agentNudgePrompt))
              updateSettings({ agentNudgePrompt: value });
            edited.current = false;
          }}
        />
      </div>
    </SettingsRow>
  );
}
