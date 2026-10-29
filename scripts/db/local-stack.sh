#!/usr/bin/env bash
# Local database harness for integration tests (T014).
#
# Preferred path: the Supabase CLI (`npx supabase@2.115.0 start`). When its Docker images
# cannot be pulled, this script builds an equivalent stack from real components:
#   PostgreSQL 16 (host binaries) + GoTrue (Supabase Auth image) + PostgREST image
#   + a small path gateway that maps /auth/v1 and /rest/v1 like Kong does.
# Differences from Supabase are documented in docs/sdd/evidence/phase-3/README.md.
#
# Usage: scripts/db/local-stack.sh up|down|reset|status|env
# Secrets are generated per stack and stored only under .local/ (git-ignored).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
STATE="$ROOT/.local/supabase"
PGDATA="$STATE/pgdata"
SOCK="$STATE/sock"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
PG_PORT="${PG_PORT:-54322}"
GATEWAY_PORT="${GATEWAY_PORT:-54321}"
GOTRUE_PORT="${GOTRUE_PORT:-54332}"
POSTGREST_PORT="${POSTGREST_PORT:-54331}"
GOTRUE_IMAGE="${GOTRUE_IMAGE:-supabase/gotrue:v2.195.0}"
POSTGREST_IMAGE="${POSTGREST_IMAGE:-postgrest/postgrest:v16.1}"
PG_USER_OS="${PG_USER_OS:-pglocal}"

as_pg() {
  if [ "$(id -u)" = "0" ]; then su "$PG_USER_OS" -s /bin/bash -c "$*"; else bash -c "$*"; fi
}
psql_su() { "$PG_BIN/psql" -h "$SOCK" -p "$PG_PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q "$@"; }

ensure_secrets() {
  mkdir -p "$STATE"
  if [ ! -f "$STATE/secrets.env" ]; then
    rand() { node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"; }
    {
      echo "JWT_SECRET=$(rand)"
      echo "AUTHENTICATOR_PASSWORD=$(rand)"
      echo "AUTH_ADMIN_PASSWORD=$(rand)"
      echo "POSTGRES_PASSWORD=$(rand)"
    } > "$STATE/secrets.env"
    chmod 600 "$STATE/secrets.env"
  fi
  # shellcheck disable=SC1091
  source "$STATE/secrets.env"
}

start_postgres() {
  if [ "$(id -u)" = "0" ] && ! id "$PG_USER_OS" >/dev/null 2>&1; then useradd -r -M -s /bin/bash "$PG_USER_OS"; fi
  mkdir -p "$SOCK"
  [ "$(id -u)" = "0" ] && chown -R "$PG_USER_OS" "$STATE"
  local fresh=0
  if [ ! -f "$PGDATA/PG_VERSION" ]; then
    fresh=1
    echo "$POSTGRES_PASSWORD" > "$STATE/.pwfile"; [ "$(id -u)" = "0" ] && chown "$PG_USER_OS" "$STATE/.pwfile"
    as_pg "$PG_BIN/initdb -D '$PGDATA' -U postgres --pwfile='$STATE/.pwfile' --auth-local=trust --auth-host=scram-sha-256 -E UTF8 --locale=C.UTF-8 >/dev/null"
    rm -f "$STATE/.pwfile"
    echo "shared_preload_libraries = ''" >> "$PGDATA/postgresql.conf"
  fi
  if ! as_pg "$PG_BIN/pg_ctl -D '$PGDATA' status >/dev/null 2>&1"; then
    as_pg "$PG_BIN/pg_ctl -D '$PGDATA' -l '$STATE/postgres.log' -o \"-p $PG_PORT -k $SOCK -c listen_addresses=127.0.0.1 -c timezone=UTC\" -w start >/dev/null"
  fi
  if [ "$fresh" = "1" ]; then
    psql_su -v authenticator_password="$AUTHENTICATOR_PASSWORD" -v auth_admin_password="$AUTH_ADMIN_PASSWORD" -f "$ROOT/supabase/local/bootstrap.sql"
  fi
}

start_gotrue() {
  docker rm -f vnr202-gotrue >/dev/null 2>&1 || true
  docker run -d --name vnr202-gotrue --network host \
    -e GOTRUE_API_HOST=127.0.0.1 -e PORT="$GOTRUE_PORT" \
    -e API_EXTERNAL_URL="http://127.0.0.1:$GATEWAY_PORT/auth/v1" \
    -e GOTRUE_SITE_URL="http://localhost:3000" \
    -e GOTRUE_DB_DRIVER=postgres \
    -e DATABASE_URL="postgres://supabase_auth_admin:$AUTH_ADMIN_PASSWORD@127.0.0.1:$PG_PORT/postgres?sslmode=disable" \
    -e GOTRUE_JWT_SECRET="$JWT_SECRET" -e GOTRUE_JWT_EXP=3600 -e GOTRUE_JWT_AUD=authenticated \
    -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated -e GOTRUE_JWT_ADMIN_ROLES=service_role \
    -e GOTRUE_DISABLE_SIGNUP=true -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true -e GOTRUE_MAILER_AUTOCONFIRM=true \
    -e GOTRUE_PASSWORD_MIN_LENGTH="${GOTRUE_PASSWORD_MIN_LENGTH:-6}" \
    -e GOTRUE_RATE_LIMIT_TOKEN_REFRESH=1800 -e GOTRUE_RATE_LIMIT_VERIFY=1800 \
    "$GOTRUE_IMAGE" >/dev/null
  for _ in $(seq 1 60); do
    curl -fsS "http://127.0.0.1:$GOTRUE_PORT/health" >/dev/null 2>&1 && return 0
    sleep 1
  done
  docker logs vnr202-gotrue | tail -30
  echo "GoTrue did not become healthy" >&2
  exit 1
}

apply_migrations() {
  psql_su -f "$ROOT/supabase/local/post-auth.sql"
  psql_su -c "create table if not exists public._harness_migrations (name text primary key, applied_at timestamptz default now()); revoke all on public._harness_migrations from anon, authenticated;"
  for f in "$ROOT"/supabase/migrations/*.sql; do
    local name; name="$(basename "$f")"
    if [ -z "$(psql_su -tAc "select 1 from public._harness_migrations where name = '$name'")" ]; then
      psql_su -1 -f "$f"
      psql_su -c "insert into public._harness_migrations(name) values ('$name')"
      echo "applied $name"
    fi
  done
  if [ -z "$(psql_su -tAc "select 1 from public._harness_migrations where name = 'seed.sql'")" ]; then
    psql_su -1 -f "$ROOT/supabase/seed.sql" >/dev/null
    psql_su -c "insert into public._harness_migrations(name) values ('seed.sql')"
  fi
}

start_postgrest() {
  docker rm -f vnr202-postgrest >/dev/null 2>&1 || true
  docker run -d --name vnr202-postgrest --network host \
    -e PGRST_DB_URI="postgres://authenticator:$AUTHENTICATOR_PASSWORD@127.0.0.1:$PG_PORT/postgres" \
    -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$JWT_SECRET" \
    -e PGRST_SERVER_HOST=127.0.0.1 -e PGRST_SERVER_PORT="$POSTGREST_PORT" -e PGRST_DB_EXTRA_SEARCH_PATH=extensions \
    "$POSTGREST_IMAGE" >/dev/null
  for _ in $(seq 1 30); do
    curl -fsS "http://127.0.0.1:$POSTGREST_PORT/" >/dev/null 2>&1 && return 0
    sleep 1
  done
  docker logs vnr202-postgrest | tail -20
  echo "PostgREST did not start" >&2
  exit 1
}

start_gateway() {
  if [ -f "$STATE/gateway.pid" ] && kill -0 "$(cat "$STATE/gateway.pid")" 2>/dev/null; then return 0; fi
  GATEWAY_PORT="$GATEWAY_PORT" GOTRUE_PORT="$GOTRUE_PORT" POSTGREST_PORT="$POSTGREST_PORT" \
    nohup node "$ROOT/scripts/db/gateway.mjs" > "$STATE/gateway.log" 2>&1 &
  echo $! > "$STATE/gateway.pid"
  sleep 1
}

write_env() {
  local anon service
  anon="$(node "$ROOT/scripts/db/jwt.mjs" "$JWT_SECRET" anon)"
  service="$(node "$ROOT/scripts/db/jwt.mjs" "$JWT_SECRET" service_role)"
  cat > "$STATE/stack.env" <<ENV
SUPABASE_URL=http://127.0.0.1:$GATEWAY_PORT
SUPABASE_ANON_KEY=$anon
SUPABASE_SERVICE_ROLE_KEY=$service
SUPABASE_DB_URL=postgres://postgres:$POSTGRES_PASSWORD@127.0.0.1:$PG_PORT/postgres
SUPABASE_JWT_SECRET=$JWT_SECRET
SUPABASE_STACK=local-fallback
ENV
  chmod 600 "$STATE/stack.env"
}

stop_all() {
  if [ -f "$STATE/gateway.pid" ]; then kill "$(cat "$STATE/gateway.pid")" 2>/dev/null || true; rm -f "$STATE/gateway.pid"; fi
  docker rm -f vnr202-gotrue vnr202-postgrest >/dev/null 2>&1 || true
  if [ -f "$PGDATA/PG_VERSION" ]; then as_pg "$PG_BIN/pg_ctl -D '$PGDATA' -m fast stop >/dev/null 2>&1" || true; fi
}

case "${1:-}" in
  up)
    ensure_secrets
    start_postgres
    start_gotrue
    apply_migrations
    start_postgrest
    start_gateway
    write_env
    echo "stack ready; env in .local/supabase/stack.env"
    ;;
  down) stop_all ;;
  reset) stop_all; rm -rf "$STATE"; "$0" up ;;
  status)
    as_pg "$PG_BIN/pg_ctl -D '$PGDATA' status" || true
    docker ps --filter name=vnr202- --format '{{.Names}} {{.Status}}'
    ;;
  env) cat "$STATE/stack.env" ;;
  *) echo "usage: $0 up|down|reset|status|env" >&2; exit 2 ;;
esac
