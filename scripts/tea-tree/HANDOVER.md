# TeaTree handover (2026-10-12)

From the Hows session that built the TeaTree features, to the agent that owns T3 Code (TeaTree) work from now on.
Read `scripts/tea-tree/NOTES.md` (build, install, data) and the [issues](https://github.com/bogorman/t3code/issues?q=label%3Atea-tree).

## Rules from the owner

- TeaTree features are **ours**:
  - one GitHub issue each (labels `enhancement` and `tea-tree`)
  - commits reference the issue
  - mockups are committed with the feature under `docs/tea-tree/<feature>/`
  - no PR needed
  - nothing goes upstream (pingdotgg/t3code) without asking the owner
- **Stay generic:** nothing specific to Hows or any other tool. Tools integrate through MCP, links and settings.
- **Never write data the official app can't use.** TeaTree uses `~/.t3-teatree` and bundle id
  `com.t3tools.t3code.teatree`; the official app keeps `~/.t3`.
- **Agents are per machine.** Cross-machine messaging goes through the integrated project tool (e.g. Hows card
  howsitgoing-40), not T3.
- **Example project names in mockups and docs:** howsitgoing, playvesting, wush, lexie. Don't show racinghub or bz.

## State

| Issue | Feature                                                                         | Branch                         | State             |
| ----- | ------------------------------------------------------------------------------- | ------------------------------ | ----------------- |
| #4    | Desktop opens `t3code://threads/…`                                              | `desktop-thread-links` (PR #1) | done              |
| #5    | Message on settle                                                               | `settle-prompt` (PR #2)        | done              |
| #6    | Thread badges (MCP), needs-you                                                  | `thread-badges` (PR #3)        | done              |
| #7    | Agents on threads: state dot, hover name, strip, `@agent`, Keep agent on, Nudge | `thread-agents`                | done, both phases |

- **`tea-tree-next`** (worktree `~/work/local/AI/t3code-build`) = `origin/tea-tree` + README (`tea-tree-readme`) +
  `thread-agents`. That's what the current build is:
  `t3code-build/release/T3-Code-0.0.45-preview.20261012.5244-arm64.dmg`. The owner is about to install and test it.
- **Local `tea-tree`** (`~/work/local/AI/t3code`) has uncommitted "thread link groups" work from another session.
  - Commit `198ae570c7` on `tea-tree` used `git commit -a` and swept in 27 lines of that work (a project-pill row in
    `Sidebar.tsx`); `tea-tree-next` backs it out.
  - When the link-groups work is ready: give it an issue, put it on its own branch off upstream `main`, reset
    `tea-tree` to `tea-tree-next`, then merge that branch.
- **Worktrees** (all clean):
  - `t3code-agents` (`thread-agents`)
  - `t3code-build` (`tea-tree-next`)
  - `t3code-readme` (`tea-tree-readme`, merged; can be removed)
- **`scripts/tea-tree/build.sh`** rebases the feature branches (now including `thread-agents`) onto upstream and
  rebuilds `tea-tree`. It assumes `tea-tree` has been reset as above.

## Gotchas

- **Node version:** Node 24 (`nvm use 24`) for builds and commit hooks; the default Node 18 breaks the hooks.
- **Commits in the shared checkout:** don't `git commit -a` there. Stage paths explicitly.
- **New MCP tools** must be registered in `packages/shared/src/t3McpToolPresentation.ts`, or `core.test.ts` fails.
- **Exhaustive switches:** new thread commands and events need a case in every switch: Orchestrator (×4),
  ProjectionStore (×3), ProjectionMaintenance, AgentAwarenessRelay, client `orchestrationV2Projection`, and the test
  kit.
- **Merging features:** they collide beside the auto-settle code; keep both sides, then fix the split
  object/`case` blocks.
- **Known test failures:**
  - On this Mac, 8 server tests fail on unchanged upstream main.
  - `OpenCode2AdapterV2.test.ts` has 23 type errors upstream.
  - On `tea-tree`, desktop tests that expect "Alpha" or `~/.t3` fail by design.
- **Install:** you can't install TeaTree from a session running inside T3; quitting T3 ends the session.

## Open

- **Owner testing** of the 0.0.45-preview.20261012.5244 build (all of #4–#7).
- **Git history:** the old mockup (commit `70318af714` on `thread-agents`) still shows racinghub and bz. The owner was
  asked whether to rewrite that commit and force-push. Not answered yet.
- **Decision:** whether TeaTree should get its own environment id (see NOTES "Open questions").
- **Old fork PRs:** PRs #1–#3 are still open in the fork; they close their issues. Close them if the owner prefers.
