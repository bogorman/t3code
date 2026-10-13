import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import { planThreadLink } from "@t3tools/client-runtime/state/thread-links";
import { runAtomCommand, squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import { AuthOrchestrationOperateScope, type ScopedThreadRef } from "@t3tools/contracts";
import type * as Cause from "effect/Cause";
import * as Haptics from "expo-haptics";
import { Atom } from "effect/reactivity";
import { Alert } from "react-native";

import { uuidv4 } from "../../lib/uuid";
import { appAtomRegistry } from "../../state/atom-registry";
import { readEnvironmentScope } from "../../state/session";
import { threadEnvironment } from "../../state/threads";

/** Thread the "Link to thread…" picker is choosing a partner for, or null
    while the picker is closed. Mounted once by ThreadLinkPickerHost. */
export const threadLinkPickerSourceAtom = Atom.make<ScopedThreadRef | null>(null).pipe(
  Atom.keepAlive,
);

export function openThreadLinkPicker(thread: EnvironmentThreadShell): void {
  appAtomRegistry.set(threadLinkPickerSourceAtom, {
    environmentId: thread.environmentId,
    threadId: thread.id,
  });
}

function failureMessage(result: { readonly cause: Cause.Cause<unknown> }, fallback: string) {
  const error = squashAtomCommandFailure(result);
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

function canOperate(thread: EnvironmentThreadShell, title: string): boolean {
  if (readEnvironmentScope(thread.environmentId, AuthOrchestrationOperateScope)) return true;
  Alert.alert(title, "This connection cannot change threads.");
  return false;
}

async function sendLink(thread: EnvironmentThreadShell, linkGroupId: string): Promise<boolean> {
  const result = await runAtomCommand(
    appAtomRegistry,
    threadEnvironment.link,
    { environmentId: thread.environmentId, input: { threadId: thread.id, linkGroupId } },
    { reportFailure: false },
  );
  if (result._tag === "Success") return true;
  Alert.alert("Could not link threads", failureMessage(result, "The threads could not be linked."));
  return false;
}

/** Links `source` onto `target` (same environment): joins the target's group,
    else pulls the target into the source's, else starts a new group. */
export async function linkThreads(
  source: EnvironmentThreadShell,
  target: EnvironmentThreadShell,
): Promise<boolean> {
  if (!canOperate(source, "Could not link threads")) return false;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  const plan = planThreadLink(source, target, uuidv4);
  if (plan.linkTarget && !(await sendLink(target, plan.linkGroupId))) return false;
  return plan.linkSource ? sendLink(source, plan.linkGroupId) : true;
}

export async function unlinkThread(thread: EnvironmentThreadShell): Promise<boolean> {
  if (!canOperate(thread, "Could not unlink thread")) return false;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  const result = await runAtomCommand(
    appAtomRegistry,
    threadEnvironment.unlink,
    { environmentId: thread.environmentId, input: { threadId: thread.id } },
    { reportFailure: false },
  );
  if (result._tag === "Success") return true;
  Alert.alert(
    "Could not unlink thread",
    failureMessage(result, "The thread could not be unlinked."),
  );
  return false;
}
