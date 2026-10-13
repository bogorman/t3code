import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { projectKeysNeedingUser } from "@t3tools/client-runtime/state/projects-needing-user";
import { useMemo } from "react";

import { scopedProjectKey } from "../../lib/scopedEntities";
import { ListFilterPill } from "../workspace/ListFilterMenu";
import type { HomeProjectScope } from "./homeThreadList";

/**
 * One-tap project scope chips for the thread list filter row (TeaTree #8).
 * Tapping the selected pill clears the scope. While scoped, pills of other
 * projects show a dot when one of their hidden threads needs the user.
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
  const needsUser = useMemo(() => {
    if (selectedProjectKey === null) return new Set<string>();
    const scopeKeyByProjectKey = new Map(
      scopes.flatMap((scope) =>
        scope.projectRefs.map(
          (ref) => [scopedProjectKey(ref.environmentId, ref.projectId), scope.key] as const,
        ),
      ),
    );
    return projectKeysNeedingUser({
      threads,
      projectKeyOf: (thread) =>
        scopeKeyByProjectKey.get(scopedProjectKey(thread.environmentId, thread.projectId)),
      selectedProjectKey,
    });
  }, [scopes, threads, selectedProjectKey]);

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
        return (
          <ListFilterPill
            key={scope.key}
            label={scope.title}
            active={active}
            needsUser={needsUser.has(scope.key)}
            onPress={() => props.onProjectChange(active ? null : scope.key)}
          />
        );
      })}
    </>
  );
}
