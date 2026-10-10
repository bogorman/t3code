#!/bin/sh
# Tea Tree: rebuild the local T3 Code (TeaTree) app on top of a newer upstream.
#
#   scripts/tea-tree/build.sh               # rebase the features onto upstream/main, rebuild tea-tree, build
#   scripts/tea-tree/build.sh v0.0.46       # same, on a release tag or commit
#   NO_REBASE=1 scripts/tea-tree/build.sh   # just build the current tea-tree branch
#
# Feature branches, each a PR in the fork (generic, nothing app-specific):
#   desktop-thread-links  settle-prompt  thread-badges
# Local-only commits on tea-tree (never upstream), re-applied on every rebuild: subjects starting
# "Tea Tree" or "README" (the TeaTree label, the README note, this script).
#
# The build gets a "-preview" version, so it ships without an update feed and the official updater
# never replaces it. Install by hand from release/. Stops at the first conflict.
set -eu
cd "$(dirname "$0")/../.."
. "$HOME/.nvm/nvm.sh" >/dev/null && nvm use 24 >/dev/null
FEATURES="desktop-thread-links settle-prompt thread-badges"
BASE="${1:-upstream/main}"

if [ -z "${NO_REBASE:-}" ]; then
  test -z "$(git status --porcelain)" || { echo "Working tree not clean."; exit 1; }
  git fetch -q upstream --tags
  for b in $FEATURES; do
    echo "== rebase $b onto $BASE"
    git switch -q "$b"
    git rebase -q "$BASE" || { echo "Conflict in $b: resolve, git rebase --continue, then rerun."; exit 1; }
    git push -q --force-with-lease origin "$b"
  done
  echo "== rebuild tea-tree on $BASE"
  OLD=$(git rev-parse tea-tree)
  LOCAL_COMMITS=$(git log --reverse --no-merges --format='%H %s' "$(git merge-base "$OLD" "$BASE")..$OLD" \
    | grep -E '^[0-9a-f]+ (Tea Tree|README)' | cut -d' ' -f1)
  git switch -q -C tea-tree "$BASE"
  for b in $FEATURES; do git merge -q --no-ff --no-edit "$b"; done
  for c in $LOCAL_COMMITS; do
    git cherry-pick -x "$c" >/dev/null ||
      { echo "Conflict re-applying $c: resolve, git cherry-pick --continue, then NO_REBASE=1 $0"; exit 1; }
  done
  git push -q --force-with-lease origin tea-tree
fi

pnpm install --frozen-lockfile >/dev/null
VERSION="$(node -p 'require("./apps/desktop/package.json").version')-preview.$(date +%Y%m%d).$(git rev-list --count HEAD)"
echo "== build T3 Code (TeaTree) $VERSION"
T3CODE_DESKTOP_VERSION="$VERSION" PATH=/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.cargo/bin:$PATH \
  pnpm run dist:desktop:dmg:arm64
# The build regenerates this file; keep the tree clean.
git checkout -- apps/desktop/src/preview/AnnotationStyles.generated.ts 2>/dev/null || true
ls -1 release/*.dmg
