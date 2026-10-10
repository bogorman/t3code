#!/bin/bash
# Tea Tree: copy the official app's threads and settings into TeaTree (~/.t3-teatree).
# First run: seeds it. Later, with --force: a "sync forward" that replaces TeaTree's threads with the official
# app's (it lists any TeaTree-only threads first, and keeps a backup).
#
# Copied: the thread database, settings, keybindings, environment id, secrets and sign-in tokens, attachments
# (APFS clones, no extra space). Not copied: worktrees (threads keep pointing at ~/.t3/worktrees), caches, logs.
set -eu
. "$(dirname "$0")/lib.sh"
require_apps_quit
SRC_DB=$(thread_db "$OFFICIAL")
[ -e "$SRC_DB" ] || { echo "No official T3 Code data in $OFFICIAL."; exit 1; }
if [ -d "$TEATREE" ]; then
  [ "${1:-}" = "--force" ] || { echo "$TEATREE exists. Rerun with --force to replace TeaTree's threads with the official app's."; exit 1; }
  DST_DB=$(thread_db "$TEATREE")
  guard_lost_threads "$SRC_DB" "$DST_DB" "TeaTree" --force
  backup_file "$DST_DB"
fi
mkdir -p "$TEATREE"
# TeaTree reads statev2.sqlite; from an old-format official app it seeds that itself from state.sqlite.
rm -f "$TEATREE/statev2.sqlite" "$TEATREE/state.sqlite"
copy_db "$SRC_DB" "$TEATREE/$(basename "$SRC_DB")"
for f in settings.json keybindings.json client-settings.json desktop-settings.json environment-id \
         clerk-tokens.json model-manifest.json usage-model-rates.json; do
  [ -e "$OFFICIAL/$f" ] && cp -p "$OFFICIAL/$f" "$TEATREE/"
done
for d in secrets attachments themes; do
  [ -d "$OFFICIAL/$d" ] && cp -cRp "$OFFICIAL/$d" "$TEATREE/"
done
chmod -R go-rwx "$TEATREE"
echo "Copied $(thread_ids "$TEATREE/$(basename "$SRC_DB")" | wc -l | tr -d ' ') threads from the official app into TeaTree."
