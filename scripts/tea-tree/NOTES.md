# Tea Tree: notes (2026-10-10)

**T3 Code (TeaTree)** is the owner's own build of T3 Code: upstream plus a few generic features we want before they
land upstream. The name is a joke ("T3" in a Dublin accent). Fork: github.com/bogorman/t3code, cloned at
`~/work/local/AI/t3code`.

## Branches

| Branch                 | What                                                                                    | State         |
| ---------------------- | --------------------------------------------------------------------------------------- | ------------- |
| `main`                 | upstream (pingdotgg/t3code) unchanged                                                   | mirror        |
| `desktop-thread-links` | desktop app opens `t3code://threads/<environmentId>/<threadId>`                         | fork PR #1    |
| `settle-prompt`        | "Message on settle" setting: a thread gets one more turn (e.g. a skill) when it settles | fork PR #2    |
| `thread-badges`        | MCP `t3_thread_badge_set` / `_clear`: badges from outside tools, with a needs-you mark  | fork PR #3    |
| `thread-agents`        | agents on threads: state, names, strip, `@agent`, keep agent on, Nudge                  | issue #7      |
| `tea-tree`             | `main` + the feature branches + local-only commits                                      | what we build |

- **Feature branches are generic:** nothing specific to Hows or any one tool, so they can go upstream. Nothing has
  been sent upstream; ask the owner first.
- **Local-only commits** on `tea-tree` (subjects start with "Tea Tree" or "README", never upstream):
  - label "T3 Code (TeaTree)"
  - bundle id `com.t3tools.t3code.teatree`
  - data folder `~/.t3-teatree`
  - these notes and the scripts
- **Related upstream work:** PR #8246 (a bigger version of #1), the plugin event feed (#16046–#16048), and settle
  scripts (#16290, merged).
- **Requirements:** `~/work/local/AI/howsitgoing/plans/feature/11-t3-desktop-thread-links.md`, Parts 1–3.

## Build

```sh
cd ~/work/local/AI/t3code
scripts/tea-tree/build.sh            # rebase features onto upstream/main, rebuild tea-tree, build the DMG
scripts/tea-tree/build.sh v0.0.46    # same, on a release tag
NO_REBASE=1 scripts/tea-tree/build.sh   # just build the current tea-tree
```

- **Output:** `release/T3-Code-<version>-preview.<date>.<n>-arm64.dmg`, about 15 minutes.
- **Updates:** the `-preview` version means the app ships with no update feed, so the official updater never replaces
  it.
- **Conflicts:** the script stops at the first one (feature rebase or local-commit cherry-pick) and says what to do.
- **Toolchain:**
  - Node 24 (nvm), pnpm 11 (corepack)
  - Rust 1.95+ (rustup), Xcode command-line tools
  - the script runs the packaging step with system tools first on PATH (Homebrew's rsync breaks Electron packaging)
- **Signing:** the app is ad-hoc signed (this Mac only), so macOS asks you to confirm on first open.
- **Tests:** the four desktop tests that expect the name "Alpha" fail on `tea-tree` on purpose. Eight server tests fail
  on this Mac on unchanged upstream too (file-system and sandbox specific).

## Install

1. Quit T3 Code (Alpha). This ends any agent session running inside it.
2. `scripts/tea-tree/seed-home.sh`: copies the official app's threads, settings, sign-ins and attachments into
   `~/.t3-teatree` (attachments as APFS clones).
3. Open the DMG and drag **T3 Code (TeaTree)** into Applications, next to the official app.
4. Open it, and confirm the "unidentified developer" prompt once.

## Data: two apps, two folders

- **Folders:** official app `~/.t3` (and `~/Library/Application Support/T3 Code (Alpha)`); TeaTree `~/.t3-teatree`
  (and `…/t3code-v2`). Neither writes to the other's folder.
- **Why separate:** a dry run on a copy of real data showed the newer code rewrites shared config files
  (`settings.json` provider entries, `keybindings.json`). The official 0.0.45 app might not handle those, so TeaTree
  must not share `~/.t3`.
- **Thread format:** TeaTree (like upstream `main`) keeps threads in `statev2.sqlite`. On first start it builds that
  from a read-only copy of `state.sqlite` and never writes the old file.
- **Verified on the copy:**
  - 131 of 131 threads and 15,592 messages imported
  - the original `state.sqlite` byte-identical afterwards
- **Threads diverge after the copy:** threads started in TeaTree don't appear in the official app, and the reverse.
  The Claude/Codex sessions themselves (`~/.claude`, `~/.codex`) are shared, so either app can resume them.
- **Shared on disk (fine):** worktrees under `~/.t3/worktrees`, and project folders.
- **Same environment id:** `seed-home.sh` copies `environment-id`, so TeaTree's thread links
  (`t3code://threads/<env>/<thread>`) match the ids Hows already stored. Open question: give TeaTree its own
  environment id (see below).
- **Don't run both at once:** same port (3773), and `t3code://` links go to only one of them.
- **Refreshing TeaTree:** `seed-home.sh --force` replaces TeaTree's threads with the official app's. It lists any
  TeaTree-only threads first and keeps a backup in `~/.t3-teatree/userdata/backups/`.

## Switching back to the official app

Settle all threads in TeaTree, quit it, and open T3 Code (Alpha). Pick the work up again from Hows: its cards,
sessions and resume prompts know what each session was doing. Copying TeaTree's threads back isn't needed. (It also
isn't possible while the official app is on the old 0.0.45 format; once both are on the new format it would be.)

## Risks

- **Newer code:** TeaTree is upstream `main` (pre-0.0.46), newer than the official 0.0.45, so expect the odd rough
  edge.
- **Ad-hoc signed:** the in-app browser starts with fresh cookies (new keychain identity). macOS permissions (screen
  recording, accessibility) are granted again for the new bundle id.
- **New releases:** our features may conflict with upstream. `build.sh` stops; resolve, then rebuild.
- **No updates:** TeaTree never updates itself. Rebuild with `build.sh` when a release lands.

## Hows integration (next steps, Hows side)

- **Open in T3:** use `t3code://threads/<env>/<thread>` (needs PR #1, which TeaTree has).
- **Badges:** keep TeaTree's sidebar badges current with open cards per session, with needs-you from Check & close
  (PR #3). Planned for the Mac app: `howsitgoing/plans/feature/12-mac-desktop-app-spec.md`.
- **Message on settle** (PR #2): set it to `/hows-settle` so threads report to Hows as they settle.
- **Track machine and environment, not just folder:** Hows should record, per session, the machine (hostname) and the
  T3 environment (environment id plus which app, official or TeaTree), since one owner can have several of each.
  Today `integrations/lib/t3_threads.py` reads only `~/.t3`; it should also read `~/.t3-teatree`, and the session
  hook should send the machine name.

## Open questions

1. Should TeaTree get its own environment id (clearer when tracking environments) at the cost of existing links
   pointing at the official environment?
2. Which upstream base: `main` (newest) or the latest release tag (steadier)? `build.sh <tag>` supports both.
