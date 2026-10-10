#!/bin/sh
# Tea Tree: one-time seed of ~/.t3-teatree from the official app's ~/.t3, so T3 Code (TeaTree)
# opens with all current threads and settings while the official app's files stay untouched.
#
# Quit both T3 Code apps first. Safe to rerun: it refuses if ~/.t3-teatree already exists
# (pass --force to replace it with a fresh copy; TeaTree-only threads are then lost).
#
# Copied: the database (SQLite backup, consistent), settings, keybindings, environment id,
# secrets and sign-in tokens, attachments (APFS clones, no extra space).
# Not copied: worktrees (threads keep pointing at ~/.t3/worktrees on disk), caches, logs.
set -eu
SRC="$HOME/.t3/userdata"
DEST_HOME="$HOME/.t3-teatree"
DEST="$DEST_HOME/userdata"
if [ -e "$DEST_HOME" ]; then
  [ "${1:-}" = "--force" ] || { echo "$DEST_HOME exists; rerun with --force to replace it."; exit 1; }
  mv "$DEST_HOME" "$DEST_HOME.old.$(date +%Y%m%d%H%M%S)"
fi
if pgrep -f "T3 Code \(" >/dev/null; then echo "Quit T3 Code first."; exit 1; fi
mkdir -p "$DEST"
sqlite3 "file:$SRC/state.sqlite?mode=ro" ".backup '$DEST/state.sqlite'"
for f in settings.json keybindings.json client-settings.json desktop-settings.json environment-id \
         clerk-tokens.json model-manifest.json usage-model-rates.json; do
  [ -e "$SRC/$f" ] && cp -p "$SRC/$f" "$DEST/"
done
for d in secrets attachments themes; do
  [ -d "$SRC/$d" ] && cp -cRp "$SRC/$d" "$DEST/"
done
chmod -R go-rwx "$DEST"
echo "Seeded $DEST from $SRC ($(sqlite3 "file:$DEST/state.sqlite?mode=ro" 'select count(*) from projection_threads where deleted_at is null') threads)."
