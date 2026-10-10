# Shared helpers for the Tea Tree data scripts. Sourced, not run.
OFFICIAL="$HOME/.t3/userdata"
TEATREE="$HOME/.t3-teatree/userdata"

require_apps_quit() {
  if pgrep -f "T3 Code \(" >/dev/null; then echo "Quit every T3 Code app first (official and TeaTree)."; exit 1; fi
}

# The thread database a folder holds: statev2.sqlite (new format) or state.sqlite (old, 0.0.45 and earlier).
thread_db() {
  if [ -e "$1/statev2.sqlite" ]; then echo "$1/statev2.sqlite"; else echo "$1/state.sqlite"; fi
}

# Live thread ids, one per line, for either format.
thread_ids() {
  case "$1" in
    *statev2.sqlite) sqlite3 "$1" "select id from orchestration_v2_projection_threads
                                   where json_extract(payload_json, '\$.deletedAt') is null" ;;
    *) sqlite3 "$1" "select thread_id from projection_threads where deleted_at is null" ;;
  esac | sort
}

# Highest schema migration a database has, or 0.
max_migration() { sqlite3 "$1" "select coalesce(max(migration_id), 0) from effect_sql_migrations" 2>/dev/null || echo 0; }

# Refuse to overwrite threads that exist only in the destination, unless --force.
# Usage: guard_lost_threads <source db> <destination db> <destination app name> [--force]
guard_lost_threads() {
  [ -e "$2" ] || return 0
  lost=$(comm -13 <(thread_ids "$1") <(thread_ids "$2") | wc -l | tr -d ' ')
  [ "$lost" = 0 ] && return 0
  echo "$lost thread(s) exist only in $3 and would be lost:"
  comm -13 <(thread_ids "$1") <(thread_ids "$2") | head -20
  [ "${4:-}" = "--force" ] || { echo "Rerun with --force to overwrite them (a backup is kept)."; exit 1; }
}

# Copy a SQLite database consistently (the source may be in WAL mode), replacing the destination.
copy_db() {
  tmp="$2.incoming"
  rm -f "$tmp"
  # A plain open (not mode=ro): read-only fails when the app quit cleanly and left no -shm file. Nothing is written.
  sqlite3 "$1" ".backup '$tmp'"
  rm -f "$2-wal" "$2-shm"
  mv "$tmp" "$2"
}

backup_file() {
  [ -e "$1" ] || return 0
  mkdir -p "$(dirname "$1")/backups"
  dest="$(dirname "$1")/backups/$(basename "$1").$(date +%Y%m%d%H%M%S)"
  sqlite3 "$1" ".backup '$dest'" 2>/dev/null || cp -p "$1" "$dest"
  echo "Backed up $1 → $dest"
}
