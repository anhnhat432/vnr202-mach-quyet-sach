#!/usr/bin/env bash
# Runs every pgTAP file in supabase/tests against the database in SUPABASE_DB_URL
# (from .local/supabase/stack.env when not set). Fails on any "not ok" or plan mismatch.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
if [ -z "${SUPABASE_DB_URL:-}" ]; then set -a; source "$ROOT/.local/supabase/stack.env"; set +a; fi
PSQL="${PSQL:-psql}"
command -v "$PSQL" >/dev/null || PSQL=/usr/lib/postgresql/16/bin/psql
"$PSQL" "$SUPABASE_DB_URL" -q -c "create extension if not exists pgtap with schema extensions" >/dev/null
status=0
for f in "$ROOT"/supabase/tests/*.sql; do
  out="$("$PSQL" "$SUPABASE_DB_URL" -q -X -t -A -v ON_ERROR_STOP=1 -c "set search_path = public, extensions" -f "$f" 2>&1)" || { echo "$out"; echo "ERROR $(basename "$f")"; status=1; continue; }
  if echo "$out" | grep -qE "^not ok|Looks like"; then echo "$out" | grep -E "^not ok|^#|Looks like"; echo "FAIL $(basename "$f")"; status=1
  else echo "PASS $(basename "$f") ($(echo "$out" | grep -c '^ok') assertions)"; fi
done
exit $status
