import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import {
  projectKeysNeedingUser,
  projectPillStatus,
} from "@t3tools/client-runtime/state/projects-needing-user";
import { summarizeAgentProjects } from "@t3tools/client-runtime/state/thread-agent";
import { useMemo } from "react";

import { scopedProjectKey } from "../../lib/scopedEntities";
import { ListFilterPill } from "../workspace/ListFilterMenu";
import type { HomeProjectScope } from "./homeThreadList";

/**
 * One-tap project scope chips for the thread list filter row (TeaTree #8).
 * Tapping the selected pill clears the scope. Each pill carries its agents'
 * state dot and live agent count (TeaTree #7); while scoped, pills of other
 * projects also turn needs-you when one of their hidden threads needs the user.
 * Renders nothing with fewer than two projects.
 */
export function ProjectPills(props: {
  readonly scopes: ReadonlyArray<Pick<HomeProjectScope, "key" | "title" | "projectRefs">>;
  readonly threads: ReadonlyArray<EnvironmentThreadShell>;
  readonly selectedProjectKey: string | null;
  readonly onProjectChange: (projectKey: string | null) => void;
  /** Leads with an "All" pill, for surfaces without a project menu beside the pills. */
  readonly showAll?: boolean;
}) {
  const { scopes, threads, selectedProjectKey } = props;
  const scopeByProjectKey = useMemo(
    () =>
      new Map(
        scopes.flatMap((scope) =>
          scope.projectRefs.map(
            (ref) => [scopedProjectKey(ref.environmentId, ref.projectId), scope] as const,
          ),
        ),
      ),
    [scopes],
  );
  const needsUser = useMemo(
    () =>
      selectedProjectKey === null
        ? new Set<string>()
        : projectKeysNeedingUser({
            threads,
            projectKeyOf: (thread) =>
              scopeByProjectKey.get(scopedProjectKey(thread.environmentId, thread.projectId))?.key,
            selectedProjectKey,
          }),
    [scopeByProjectKey, threads, selectedProjectKey],
  );
  const agentsByScopeKey = useMemo(() => {
    const summaries = summarizeAgentProjects({
      threads,
      projectOf: (thread) => {
        const scope = scopeByProjectKey.get(
          scopedProjectKey(thread.environmentId, thread.projectId),
        );
        return scope && { projectKey: scope.key, displayName: scope.title };
      },
    });
    return new Map(summaries.map((summary) => [summary.projectKey, summary] as const));
  }, [scopeByProjectKey, threads]);

  if (scopes.length < 2) return null;
  return (
    <>
      {props.showAll ? (
        <ListFilterPill
          label="All"
          active={selectedProjectKey === null}
          onPress={() => props.onProjectChange(null)}
        />
      ) : null}
      {scopes.map((scope) => {
        const active = scope.key === selectedProjectKey;
        const status = projectPillStatus({
          hiddenNeedsUser: needsUser.has(scope.key),
          agents: agentsByScopeKey.get(scope.key),
        });
        return (
          <ListFilterPill
            key={scope.key}
            label={scope.title}
            active={active}
            dot={status.dot}
            count={status.active}
            onPress={() => props.onProjectChange(active ? null : scope.key)}
          />
        );
      })}
    </>
  );
}
