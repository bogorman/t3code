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

/** A message, such as a skill, sent to a thread as one more turn when it settles. */
export function SettlePromptSettings() {
  const settings = useScopedSettings();
  const { targets } = useSettingsScope();
  const scopeKey = targets.map((target) => `${target.environmentId}:${target.projectId}`).join(",");
  const edited = useRef(false);
  const updateSettings = useUpdateScopedSettings();
  const mixed = useScopedSettingsMixed(["settlePrompt"]);

  return (
    <SettingsRow
      serverScoped
      settingKeys={["settlePrompt"]}
      {...searchableSetting("settle-prompt")}
      description="Sent to a thread as one more turn when it settles, for example a skill that wraps up the work. The thread settles again when that turn ends. Leave empty to send nothing."
      resetAction={
        mixed || settings.settlePrompt !== "" ? (
          <SettingResetButton
            label="message on settle"
            onClick={() => updateSettings({ settlePrompt: "" })}
          />
        ) : null
      }
    >
      <div className="mt-3 max-w-2xl pb-3.5">
        <Textarea
          key={`${scopeKey}:${mixed}:${settings.settlePrompt}`}
          aria-label="Message on settle"
          onChange={() => {
            edited.current = true;
          }}
          rows={3}
          defaultValue={mixed ? "" : settings.settlePrompt}
          placeholder={
            mixed
              ? "Mixed. Enter a message to apply to all selected targets."
              : "/wrap-up Summarise what this thread did and what is left."
          }
          onBlur={(event) => {
            const value = event.target.value.trim();
            if (edited.current && (mixed || value !== settings.settlePrompt))
              updateSettings({ settlePrompt: value });
            edited.current = false;
          }}
        />
      </div>
    </SettingsRow>
  );
}
