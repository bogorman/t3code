import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/shell";
import type { ScopedThreadRef } from "@t3tools/contracts";
import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text, AppTextInput as TextInput } from "../../components/AppText";
import { SymbolView } from "../../components/AppSymbol";
import { appAtomRegistry } from "../../state/atom-registry";
import { useProjects } from "../../state/entities";
import { environmentThreadShells } from "../../state/threads";
import { linkThreads, threadLinkPickerSourceAtom } from "./threadLinkActions";

/** Threads `source` can link onto: same environment, visible in the lists,
    not already in its group. Most recently active first. */
export function threadLinkCandidates(
  source: Pick<EnvironmentThreadShell, "id" | "environmentId" | "linkGroupId">,
  threads: ReadonlyArray<EnvironmentThreadShell>,
): EnvironmentThreadShell[] {
  // .sort() on the filtered copy: Hermes doesn't ship .toSorted().
  return threads
    .filter(
      (thread) =>
        thread.environmentId === source.environmentId &&
        thread.id !== source.id &&
        thread.archivedAt === null &&
        thread.lineage.relationshipToParent !== "subagent" &&
        (source.linkGroupId == null || thread.linkGroupId !== source.linkGroupId),
    )
    .sort((left, right) =>
      (right.latestUserMessageAt ?? right.updatedAt ?? right.createdAt).localeCompare(
        left.latestUserMessageAt ?? left.updatedAt ?? left.createdAt,
      ),
    );
}

function ThreadLinkPickerSheet(props: {
  readonly source: ScopedThreadRef;
  readonly onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const threads = useAtomValue(environmentThreadShells.navigationThreadShellsAtom);
  const projects = useProjects();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const source = threads.find(
    (thread) =>
      thread.environmentId === props.source.environmentId && thread.id === props.source.threadId,
  );
  const projectTitles = useMemo(
    () =>
      new Map(projects.map((project) => [`${project.environmentId}:${project.id}`, project.title])),
    [projects],
  );
  const candidates = useMemo(() => {
    if (!source) return [];
    const needle = query.trim().toLocaleLowerCase();
    return threadLinkCandidates(source, threads).filter(
      (thread) =>
        needle.length === 0 ||
        thread.title.toLocaleLowerCase().includes(needle) ||
        (projectTitles.get(`${thread.environmentId}:${thread.projectId}`) ?? "")
          .toLocaleLowerCase()
          .includes(needle),
    );
  }, [projectTitles, query, source, threads]);

  const choose = (target: EnvironmentThreadShell) => {
    if (!source || busy) return;
    setBusy(true);
    void linkThreads(source, target).then((linked) => {
      setBusy(false);
      if (linked) props.onClose();
    });
  };

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={props.onClose}
    >
      <View className="flex-1 bg-sheet" style={{ paddingBottom: insets.bottom }}>
        <View className="flex-row items-center justify-between gap-3 px-5 pb-2 pt-4">
          <Text className="flex-1 text-xl font-t3-semibold" numberOfLines={1}>
            Link to thread
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={props.onClose}
            className="min-h-11 justify-center px-2"
          >
            <Text className="text-base text-primary-text">Cancel</Text>
          </Pressable>
        </View>
        <Text className="px-5 pb-3 text-sm text-foreground-muted" numberOfLines={2}>
          {source
            ? `“${source.title}” will sit with the thread you pick.`
            : "This thread is no longer available."}
        </Text>
        <View className="px-4 pb-2">
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Find a thread"
            className="h-11 rounded-full border border-input-border bg-input px-4 font-sans text-base text-foreground"
            selectionColorClassName="accent-focus/32"
            cursorColorClassName="accent-focus"
            selectionHandleColorClassName="accent-focus"
            clearButtonMode="while-editing"
            onChangeText={setQuery}
            placeholder="Find a thread"
            placeholderTextColorClassName="accent-placeholder"
            value={query}
          />
        </View>
        <FlatList
          data={candidates}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(thread) => `${thread.environmentId}:${thread.id}`}
          ListEmptyComponent={
            <Text className="pt-8 text-center text-sm text-foreground-muted">
              {query.trim().length > 0 ? "No matching threads." : "No other threads to link."}
            </Text>
          }
          renderItem={({ item: thread }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityHint="Links the two threads"
              disabled={busy}
              onPress={() => choose(thread)}
              className="flex-row items-center gap-3 border-b border-border-subtle px-5 py-3 active:opacity-60"
            >
              <View className="min-w-0 flex-1">
                <Text className="text-xs text-foreground-muted" numberOfLines={1}>
                  {projectTitles.get(`${thread.environmentId}:${thread.projectId}`) ?? ""}
                </Text>
                <Text className="mt-0.5 text-base" numberOfLines={2}>
                  {thread.title}
                </Text>
              </View>
              {thread.linkGroupId ? (
                <SymbolView
                  name="link"
                  size={13}
                  tintColorClassName="accent-foreground-muted"
                  type="monochrome"
                />
              ) : null}
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

/** Mounted once beside the arrangement sheet; opened from a row's menu. */
export function ThreadLinkPickerHost() {
  const source = useAtomValue(threadLinkPickerSourceAtom);
  return source ? (
    <ThreadLinkPickerSheet
      source={source}
      onClose={() => appAtomRegistry.set(threadLinkPickerSourceAtom, null)}
    />
  ) : null;
}
