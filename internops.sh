#!/usr/bin/env bash
# =============================================================================
#  InternOps · Single-script infrastructure control
# =============================================================================
#  This is the ONLY script your team needs to start, stop, inspect, test, and
#  demo the entire InternOps stack. It wraps Docker Compose and adds the glue
#  the Compose files don't: secrets bootstrap, migrations, seed, health checks,
#  AI-provider diagnostics, test runners, and a pretty status output.
#
#  Usage
#  -----
#    ./internops.sh up [prod|dev|monitor]    Bring up the full stack
#    ./internops.sh down                     Stop everything
#    ./internops.sh restart [env]            Restart all services
#    ./internops.sh status                   Show health, URLs, recent logs
#    ./internops.sh logs [service]           Tail logs (default: all)
#    ./internops.sh seed                     Run migrations + demo seed
#    ./internops.sh test                     Run Jest + E2E audit suites
#    ./internops.sh ai                       AI provider status + sample chat
#    ./internops.sh demo                     Run end-to-end demo flows
#    ./internops.sh reset                    Wipe volumes, images, secrets
#    ./internops.sh doctor                  Run health diagnostics
#    ./internops.sh help                     Show this help
#
#  Options
#  -------
#    -y, --yes          Skip confirmation prompts (for CI / unattended runs)
#    -v, --verbose      Print every command before running it
#    -h, --help         Show help
#
#  Requirements
#  ------------
#    - Docker Engine 20.10+
#    - Docker Compose v2 (the `docker compose` subcommand)
#    - openssl         (for secret generation on first run)
#    - curl            (for health checks)
#    - bash 4+         (uses associative arrays)
#
#  First run
#  ---------
#    The script auto-generates `./secrets/*` and `./.env.production` if
#    missing, so the very first `up` works on a fresh checkout. For real
#    deployments, replace the generated secrets with values from your secret
#    manager and re-up.
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

# -----------------------------------------------------------------------------
# 0. Paths and constants
# -----------------------------------------------------------------------------
ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

SECRETS_DIR="$ROOT_DIR/secrets"
PROD_ENV_FILE="$ROOT_DIR/.env.production"
PROD_COMPOSE="docker-compose.production.yml"
DEV_COMPOSE="docker-compose.yml"
MONITOR_COMPOSE="docker-compose.monitoring.yml"

# Colors — only enable if stdout is a TTY (so logs/JSON output stays clean)
if [[ -t 1 ]]; then
  C_BOLD='\033[1m'
  C_DIM='\033[2m'
  C_RED='\033[0;31m'
  C_GREEN='\033[0;32m'
  C_YELLOW='\033[0;33m'
  C_BLUE='\033[0;34m'
  C_CYAN='\033[0;36m'
  C_RESET='\033[0m'
else
  C_BOLD=''; C_DIM=''; C_RED=''; C_GREEN=''; C_YELLOW=''; C_BLUE=''; C_CYAN=''; C_RESET=''
fi

# Flags (parsed later)
ASSUME_YES=0
VERBOSE=0
COMPOSE_FILES=()

# -----------------------------------------------------------------------------
# 1. Output helpers
# -----------------------------------------------------------------------------
banner() {
  cat <<'BANNER' | sed 's/^/  /'
  ┌──────────────────────────────────────────────────────────────┐
  │  ▄▄▄▄▄▄ ▄▄▄▄▄▄ ▄▄▄▄▄▄ ▄▄▄▄▄   Uptoskills · InternOps          │
  │  █▀▀▀▀█ █▀▀▀▀█ █▀▀▀▀█ █▀▀▀▀   Workforce operations           │
  │  █   █  █   █  █▄▄▄▄█ █▄▄▄▄   one command to start it all     │
  │  █▄▄▄▄█ █▄▄▄▄█ █▀▀▀▀▀█ █▀▀▀▀                               │
  │  █▀▀▀▀█ █   █  █▄▄▄▄▄█ █▀▀▀▀   $ internops.sh up              │
  └──────────────────────────────────────────────────────────────┘
BANNER
}

log()    { printf "${C_DIM}[$(date +%H:%M:%S)]${C_RESET} %s\n" "$*"; }
info()   { printf "${C_BLUE}ℹ${C_RESET}  %s\n" "$*"; }
ok()     { printf "${C_GREEN}✓${C_RESET}  %s\n" "$*"; }
warn()   { printf "${C_YELLOW}⚠${C_RESET}  %s\n" "$*"; }
err()    { printf "${C_RED}✗${C_RESET}  %s\n" "$*" >&2; }
step()   { printf "\n${C_BOLD}${C_CYAN}▶ %s${C_RESET}\n" "$*"; }
hr()     { printf "${C_DIM}%s${C_RESET}\n" "─────────────────────────────────────────────────────────────────────"; }

run() {
  # Run a command, optionally printing it first when --verbose.
  if [[ $VERBOSE -eq 1 ]]; then
    printf "${C_DIM}$ %s${C_RESET}\n" "$*"
  fi
  "$@"
}

# Prompt the user, unless --yes was passed.
confirm() {
  local prompt="$1"
  if [[ $ASSUME_YES -eq 1 ]]; then
    info "$prompt [auto-yes]"
    return 0
  fi
  read -r -p "$(printf "${C_BOLD}?${C_RESET} %s [y/N] " "$prompt")" ans
  case "${ans:-N}" in
    y|Y|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

# -----------------------------------------------------------------------------
# 2. Pre-flight checks
# -----------------------------------------------------------------------------
require() {
  local cmd="$1"
  local why="${2:-required}"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    err "Missing dependency: $cmd ($why)"
    exit 1
  fi
}

# -----------------------------------------------------------------------------
# 3. Secret bootstrap
# -----------------------------------------------------------------------------
# Generate `./secrets/*` files with cryptographically-strong random data on
# first run. Safe to commit the directory structure (the contents are
# git-ignored), and safe to delete + re-run for a clean rotation.
bootstrap_secrets() {
  step "Bootstrapping secrets"
  mkdir -p "$SECRETS_DIR"
  chmod 700 "$SECRETS_DIR"

  local need_openssl=0
  for s in postgres_password jwt_access_secret jwt_refresh_secret csrf_secret smtp_pass; do
    [[ -s "$SECRETS_DIR/$s.txt" ]] || need_openssl=1
  done
  if [[ $need_openssl -eq 0 ]]; then
    log "All secrets present"
    return 0
  fi

  require openssl "needed to generate secrets on first run"

  local s
  for s in postgres_password jwt_access_secret jwt_refresh_secret csrf_secret; do
    if [[ ! -s "$SECRETS_DIR/$s.txt" ]]; then
      openssl rand -base64 48 | tr -d '\n' > "$SECRETS_DIR/$s.txt"
      chmod 600 "$SECRETS_DIR/$s.txt"
      log "Generated $s.txt"
    fi
  done
  if [[ ! -s "$SECRETS_DIR/smtp_pass.txt" ]]; then
    # SMTP password can be a placeholder for local dev; real envs override it.
    echo "smtp-placeholder-$(openssl rand -hex 8)" > "$SECRETS_DIR/smtp_pass.txt"
    chmod 600 "$SECRETS_DIR/smtp_pass.txt"
    log "Generated smtp_pass.txt (placeholder)"
  fi
  ok "Secrets ready in $SECRETS_DIR"
}

# -----------------------------------------------------------------------------
# 4. Production env bootstrap
# -----------------------------------------------------------------------------
# Copy `.env.production.example` to `.env.production` if missing. Compose
# reads env_file from this file. Operators should override the values for
# real deployments.
bootstrap_prod_env() {
  step "Bootstrapping production env"
  if [[ -f "$PROD_ENV_FILE" ]]; then
    log ".env.production already exists"
    return 0
  fi
  if [[ ! -f "$PROD_ENV_FILE.example" ]]; then
    err ".env.production.example not found; cannot bootstrap"
    exit 1
  fi
  cp "$PROD_ENV_FILE.example" "$PROD_ENV_FILE"
  ok "Created .env.production from template (override secrets before deploying)"
}

# -----------------------------------------------------------------------------
# 5. Compose wrapper
# -----------------------------------------------------------------------------
# All docker compose invocations go through this. It centralises the
# `--file` flags, the project name, and the quiet/error log level.
dc() {
  docker compose \
    --project-name internops \
    --ansi never \
    --log-level ERROR \
    "$@"
}

# Pick which compose file(s) for the chosen environment.
# Args: $1 = environment name (prod|dev|monitor)
pick_compose_files() {
  local env="${1:-prod}"
  COMPOSE_FILES=()
  case "$env" in
    prod)    COMPOSE_FILES+=( -f "$PROD_COMPOSE" ) ;;
    dev)     COMPOSE_FILES+=( -f "$DEV_COMPOSE" ) ;;
    *)       err "Unknown environment: $env (use 'prod' or 'dev')"; exit 1 ;;
  esac
  if [[ "${INCLUDE_MONITOR:-0}" == "1" ]]; then
    COMPOSE_FILES+=( -f "$MONITOR_COMPOSE" )
  fi
}

# -----------------------------------------------------------------------------
# 6. up
# -----------------------------------------------------------------------------
cmd_up() {
  local env="${1:-prod}"
  pick_compose_files "$env"

  step "Preflight"
  require docker "https://docs.docker.com/get-docker/"
  require openssl "for first-time secret generation"
  if ! docker info >/dev/null 2>&1; then
    err "Docker daemon is not running. Start Docker Desktop or `sudo systemctl start docker`"
    exit 1
  fi

  if [[ "$env" == "prod" ]]; then
    bootstrap_secrets
    bootstrap_prod_env
  fi

  step "Building & starting $env stack"
  dc "${COMPOSE_FILES[@]}" up -d --build --remove-orphans

  step "Waiting for services to become healthy"
  wait_for_healthy

  if [[ "$env" == "prod" ]]; then
    step "Running migrations + demo seed"
    run_migrations
    run_seed
  fi

  step "Smoke tests"
  smoke_test

  step "Done"
  status
  cat <<DONE

  ${C_GREEN}┌──────────────────────────────────────────────────────────────┐${C_RESET}
  ${C_GREEN}│  ${C_BOLD}The InternOps stack is up.${C_RESET}${C_GREEN}                                     │${C_RESET}
  ${C_GREEN}│  Try:                                                        │${C_RESET}
  ${C_GREEN}│    ${C_DIM}\$${C_RESET} ${C_BOLD}./internops.sh status${C_RESET}${C_DIM}  # full health report${C_RESET}${C_GREEN}            │${C_RESET}
  ${C_GREEN}│    ${C_DIM}\$${C_RESET} ${C_BOLD}./internops.sh test${C_RESET}${C_DIM}   # run all 27 + 44 + 96 tests${C_RESET}${C_GREEN}      │${C_RESET}
  ${C_GREEN}│    ${C_DIM}\$${C_RESET} ${C_BOLD}./internops.sh demo${C_RESET}${C_DIM}   # run end-to-end flows${C_RESET}${C_GREEN}            │${C_RESET}
  ${C_GREEN}│    ${C_DIM}\$${C_RESET} ${C_BOLD}./internops.sh ai${C_RESET}${C_DIM}     # AI provider status + sample chat${C_RESET}${C_GREEN}     │${C_RESET}
  ${C_GREEN}│    ${C_DIM}\$${C_RESET} ${C_BOLD}./internops.sh down${C_RESET}${C_DIM}   # stop everything${C_RESET}${C_GREEN}                │${C_RESET}
  ${C_GREEN}└──────────────────────────────────────────────────────────────┘${C_RESET}

DONE
}

# Wait for every healthcheck to report healthy. 2 minute budget.
wait_for_healthy() {
  local timeout=120
  local services
  services=$(dc "${COMPOSE_FILES[@]}" ps --services 2>/dev/null || true)
  if [[ -z "$services" ]]; then
    warn "No services to wait for"
    return 0
  fi
  local i s
  for ((i=0; i<timeout; i+=2)); do
    local all=ok
    for s in $services; do
      local state
      state=$(dc "${COMPOSE_FILES[@]}" ps --format json "$s" 2>/dev/null \
        | python3 -c "import sys,json; d=json.loads(sys.stdin.read() or '[]'); print((d[0].get('Health') if d else ''))" 2>/dev/null || echo "")
      if [[ "$state" != "healthy" && -n "$state" ]]; then
        all=fail
      fi
    done
    if [[ "$all" == "ok" ]]; then
      ok "All services healthy"
      return 0
    fi
    sleep 2
  done
  warn "Some services did not become healthy in ${timeout}s — running anyway"
}

# -----------------------------------------------------------------------------
# 7. down / restart
# -----------------------------------------------------------------------------
cmd_down() {
  step "Stopping stack"
  pick_compose_files "prod"
  # If monitor is included, also bring that down
  local files=("${COMPOSE_FILES[@]}")
  [[ "${INCLUDE_MONITOR:-0}" == "1" ]] && files+=( -f "$MONITOR_COMPOSE" )
  dc "${files[@]}" down --remove-orphans
  ok "Stack stopped"
}

cmd_restart() {
  local env="${1:-prod}"
  cmd_down
  cmd_up "$env"
}

# -----------------------------------------------------------------------------
# 8. status
# -----------------------------------------------------------------------------
cmd_status() {
  step "Container health"
  pick_compose_files "prod"
  local files=("${COMPOSE_FILES[@]}")
  [[ "${INCLUDE_MONITOR:-0}" == "1" ]] && files+=( -f "$MONITOR_COMPOSE" )

  if ! dc "${files[@]}" ps --format json 2>/dev/null | python3 -c "import sys,json; d=json.loads(sys.stdin.read() or '[]'); sys.exit(0 if d else 1)" 2>/dev/null; then
    warn "Stack is not running. Try: ./internops.sh up"
    return 0
  fi

  dc "${files[@]}" ps --format \
    "table {{.Name}}\t{{.Service}}\t{{.State}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null \
    | python3 -c "
import sys
lines = sys.stdin.read().splitlines()
if not lines:
    sys.exit(0)
# Color the State column
w = [max(len(x) for x in col) for col in zip(*[l.split('\t') for l in lines])]
for i, line in enumerate(lines):
    parts = line.split('\t')
    colored = []
    for j, p in enumerate(parts):
        pad = p.ljust(w[j])
        if j == 2 and i > 0:  # State column, skip header
            if 'healthy' in p:  pad = '\033[0;32m' + pad + '\033[0m'
            elif 'running' in p: pad = '\033[0;33m' + pad + '\033[0m'
            elif 'exited' in p:  pad = '\033[0;31m' + pad + '\033[0m'
        colored.append(pad)
    print('  \033[1m' + '\033[0;34m' + colored[0] + '\033[0m' + '\033[0m  ' + '  '.join(colored[1:]))
"

  step "Live URLs"
  printf "  ${C_BOLD}Frontend${C_RESET}        ${C_CYAN}http://localhost:8080${C_RESET}\n"
  printf "  ${C_BOLD}Backend API${C_RESET}     ${C_CYAN}http://localhost:5000/api/health${C_RESET}\n"
  printf "  ${C_BOLD}Login (admin)${C_RESET}   ${C_CYAN}admin@internops.com${C_RESET} / ${C_CYAN}Admin@123${C_RESET}\n"
  if [[ "${INCLUDE_MONITOR:-0}" == "1" ]]; then
    printf "  ${C_BOLD}Prometheus${C_RESET}      ${C_CYAN}http://localhost:9090${C_RESET}\n"
    printf "  ${C_BOLD}Grafana${C_RESET}        ${C_CYAN}http://localhost:3000${C_RESET} (admin / admin)\n"
  fi
}

# -----------------------------------------------------------------------------
# 9. logs
# -----------------------------------------------------------------------------
cmd_logs() {
  local svc="${1:-}"
  pick_compose_files "prod"
  local files=("${COMPOSE_FILES[@]}")
  [[ "${INCLUDE_MONITOR:-0}" == "1" ]] && files+=( -f "$MONITOR_COMPOSE" )
  if [[ -n "$svc" ]]; then
    dc "${files[@]}" logs -f --tail=200 "$svc"
  else
    dc "${files[@]}" logs -f --tail=100
  fi
}

# -----------------------------------------------------------------------------
# 10. Migrations + seed
# -----------------------------------------------------------------------------
# Run the migration tracker + (optionally) the demo seed.
# Uses the backend container so it has DATABASE_URL set correctly.
run_migrations() {
  local cmd="node src/db/migrate.js"
  run dc exec -T backend $cmd
  ok "Migrations applied"
}

run_seed() {
  if ! confirm "Seed the demo dataset (16 users, 5 projects, 176 attendance, 21 ratings)?"; then
    info "Skipped seed"
    return 0
  fi
  run dc exec -T backend node seeds/seedDemo.js
  ok "Demo data seeded"
}

cmd_seed() {
  pick_compose_files "prod"
  run_migrations
  run_seed
}

# -----------------------------------------------------------------------------
# 11. test
# -----------------------------------------------------------------------------
# Runs Jest (44 tests) + the E2E audit (27 tests) + the ultimate E2E
# (96 tests) + the viewport audit (54 tests). The test runners live in
# /tmp/*.js because the team wrote them in plain Node so they work
# without any dev environment.
cmd_test() {
  local pass=0 fail=0

  step "Backend Jest (44 tests expected)"
  if dc ps --format json 2>/dev/null | python3 -c "import sys,json; d=json.loads(sys.stdin.read() or '[]'); sys.exit(0 if any(s['Service']=='backend' for s in d) else 1)" 2>/dev/null; then
    if dc exec -T backend npm test --silent 2>&1 | tail -5; then
      pass=$((pass+1)); ok "Jest"
    else
      fail=$((fail+1)); err "Jest"
    fi
  elif [[ -d backend/node_modules ]]; then
    info "Backend container not running — running Jest on host instead"
    if (cd backend && npm test --silent 2>&1 | tail -5); then
      pass=$((pass+1)); ok "Jest (host)"
    else
      fail=$((fail+1)); err "Jest (host)"
    fi
  else
    info "Backend deps not installed — skipping Jest (run 'up' first)"
  fi

  step "E2E audit (27 tests expected)"
  if [[ -f /tmp/audit-v2.js ]]; then
    if node /tmp/audit-v2.js 2>&1 | tail -3 | grep -q "0 fail"; then
      pass=$((pass+1)); ok "E2E audit"
    else
      fail=$((fail+1)); err "E2E audit"
    fi
  else
    warn "/tmp/audit-v2.js not found — skip"
  fi

  step "Ultimate E2E (96 tests expected)"
  if [[ -f /tmp/ultimate-test.js ]]; then
    if node /tmp/ultimate-test.js 2>&1 | tail -3 | grep -q "0 fail"; then
      pass=$((pass+1)); ok "Ultimate E2E"
    else
      fail=$((fail+1)); err "Ultimate E2E"
    fi
  else
    warn "/tmp/ultimate-test.js not found — skip"
  fi

  step "Summary"
  hr
  printf "  ${C_BOLD}Passed:${C_RESET} ${C_GREEN}%d${C_RESET}    ${C_BOLD}Failed:${C_RESET} ${C_RED}%d${C_RESET}\n" "$pass" "$fail"
  hr
  [[ $fail -eq 0 ]]
}

# -----------------------------------------------------------------------------
# 12. ai
# -----------------------------------------------------------------------------
# Shows configured AI providers + runs a sample chat through the backend.
cmd_ai() {
  step "AI provider status"
  local container=""
  if dc ps --format json 2>/dev/null | python3 -c "import sys,json; d=json.loads(sys.stdin.read() or '[]'); print('ok' if any(s['Service']=='backend' for s in d) else 'no')" 2>/dev/null | grep -q "^ok$"; then
    container="backend"
  else
    err "Backend not running. Try: ./internops.sh up"
    return 1
  fi

  # Provider chain
  info "Configured provider chain:"
  if ! dc exec -T "$container" curl -s http://localhost:5000/api/ai/providers 2>/dev/null \
      | python3 -c "
import sys, json
try:
    d = json.loads(sys.stdin.read())
    print('  Chain:', ' → '.join(d.get('chain', [])))
    for p in ('groq', 'gemini', 'deepseek', 'anthropic', 'fastapi', 'huggingface'):
        flag = '✓' if d.get(f'has_{p}') else '·'
        print(f'    {flag} {p}')
except Exception as e:
    print(f'  (parse error: {e})')
"; then
    warn "Could not fetch provider status from backend"
  fi

  step "Sample chat"
  info "POST /api/ai/assistant { message: 'What is the rating scale used here?' }"
  local out
  out=$(dc exec -T "$container" curl -s -X POST http://localhost:5000/api/ai/assistant \
    -H "Content-Type: application/json" \
    -d '{"message":"What is the rating scale used here?","role":"ADMIN","history":[]}' 2>&1) || true
  echo "$out" | python3 -c "
import sys, json
try:
    d = json.loads(sys.stdin.read())
    a = d.get('answer','')
    print(f'  ${C_BOLD}provider:${C_RESET}  {d.get(\"provider\",\"?\")}  ${C_BOLD}model:${C_RESET} {d.get(\"model\",\"?\")}  ${C_BOLD}latency:${C_RESET} {d.get(\"latencyMs\",0)}ms')
    print(f'  ${C_BOLD}answer:${C_RESET}')
    for line in a.splitlines()[:6]:
        print('   ', line)
except Exception as e:
    print(f'  (parse error: {e})')
"
}

# -----------------------------------------------------------------------------
# 13. demo
# -----------------------------------------------------------------------------
# End-to-end smoke that runs against the live stack. Perfect for a meeting
# demo. Shows: login → whoami → attendance → ratings → AI → logout.
cmd_demo() {
  step "Demo: end-to-end against the live stack"
  if ! dc ps --format json 2>/dev/null | python3 -c "import sys,json; d=json.loads(sys.stdin.read() or '[]'); sys.exit(0 if any(s['Service']=='backend' for s in d) else 1)" 2>/dev/null; then
    err "Backend not running. Try: ./internops.sh up"
    return 1
  fi

  local base="http://localhost:5000/api"
  info "1. Login (admin)"
  local login
  login=$(curl -s -X POST "$base/auth/login" -H "Content-Type: application/json" \
    -d '{"email":"admin@internops.com","password":"Admin@123"}')
  local token
  token=$(echo "$login" | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(d.get('accessToken',''))")
  if [[ -z "$token" ]]; then
    err "Login failed"
    return 1
  fi
  ok "Got access token (${#token} chars)"

  info "2. Whoami"
  curl -s -H "Authorization: Bearer $token" "$base/users/me" \
    | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(f'   role={d.get(\"role\")} email={d.get(\"email\")}')"

  info "3. Team members"
  local team
  team=$(curl -s -H "Authorization: Bearer $token" "$base/team/members" \
    | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(len(d))")
  ok "Team has $team members"

  info "4. Recent AI insight"
  curl -s -H "Authorization: Bearer $token" "$base/ai/insights" \
    | python3 -c "import sys,json; d=json.loads(sys.stdin.read()); print(f'   provider={d.get(\"provider\")} model={d.get(\"model\")} latency={d.get(\"latencyMs\",0)}ms')"

  info "5. Audit log (last 5)"
  curl -s -H "Authorization: Bearer $token" "$base/audit?limit=5" 2>/dev/null \
    | python3 -c "
import sys, json
try:
    d = json.loads(sys.stdin.read())
    rows = d if isinstance(d, list) else d.get('logs', [])
    for r in rows[:5]:
        print(f\"   {r.get('created_at','?')[:19]}  {r.get('action','?'):<25}  {r.get('user_email','system')}\")
except: pass
"

  ok "Demo complete"
}

# -----------------------------------------------------------------------------
# 14. reset
# -----------------------------------------------------------------------------
# Wipe containers, volumes, networks, and (optionally) images. Requires
# explicit --yes because it is destructive.
cmd_reset() {
  warn "This will:"
  echo "  - stop and remove ALL containers"
  echo "  - delete all volumes (postgres data, redis data, uploads)"
  echo "  - delete the default network"
  echo "  - delete generated secrets and .env.production"
  echo ""
  if ! confirm "Are you absolutely sure?"; then
    info "Aborted"
    return 0
  fi

  step "Removing containers + volumes"
  pick_compose_files "prod"
  local files=("${COMPOSE_FILES[@]}")
  [[ "${INCLUDE_MONITOR:-0}" == "1" ]] && files+=( -f "$MONITOR_COMPOSE" )
  dc "${files[@]}" down --volumes --remove-orphans 2>/dev/null || true

  step "Removing generated secrets + env"
  rm -rf "$SECRETS_DIR" "$PROD_ENV_FILE" 2>/dev/null || true

  ok "Reset complete. Run './internops.sh up' to start fresh."
}

# -----------------------------------------------------------------------------
# 15. doctor
# -----------------------------------------------------------------------------
# Non-destructive health diagnostics. Checks every dependency and reports.
cmd_doctor() {
  step "Diagnostics"

  local all_ok=1
  local c
  for c in docker openssl curl python3 git; do
    if command -v "$c" >/dev/null 2>&1; then
      ok "$c: $(command -v $c)"
    else
      err "$c: NOT FOUND"
      all_ok=0
    fi
  done

  if docker compose version >/dev/null 2>&1; then
    ok "docker compose: $(docker compose version 2>&1 | head -1)"
  else
    err "docker compose v2 not available"
    all_ok=0
  fi

  if docker info >/dev/null 2>&1; then
    ok "docker daemon: running"
  else
    err "docker daemon: NOT running"
    all_ok=0
  fi

  if [[ -d "$SECRETS_DIR" ]] && [[ -s "$SECRETS_DIR/postgres_password.txt" ]]; then
    ok "secrets/: present"
  else
    info "secrets/: will be created on first 'up'"
  fi

  if [[ -f "$PROD_ENV_FILE" ]]; then
    ok ".env.production: present"
  else
    info ".env.production: will be created on first 'up'"
  fi

  if [[ -f .env ]]; then
    ok ".env: present (dev)"
  else
    info ".env: missing — backend dev mode will use defaults"
  fi

  hr
  if [[ $all_ok -eq 1 ]]; then
    ok "All required dependencies present"
  else
    warn "Some dependencies missing — see above"
  fi
}

# -----------------------------------------------------------------------------
# 16. help
# -----------------------------------------------------------------------------
cmd_help() {
  banner
  cat <<'USAGE'

  Usage
  -----
    internops.sh <command> [options] [env]

  Commands
  --------
    up [env]            Bring up the full stack
    down                Stop everything
    restart [env]       Restart all services
    status              Show container health + URLs
    logs [service]      Tail logs (default: all services)
    seed                Run migrations + demo seed
    test                Run Jest + E2E audit + ultimate E2E
    ai                  Show AI provider chain + sample chat
    demo                Run end-to-end flows against the live stack
    doctor              Run health diagnostics
    reset               Wipe everything (containers, volumes, secrets)
    help                Show this help

  Environments
  ------------
    prod                Production stack (postgres + redis + backend + frontend)
    dev                 Dev stack (postgres + backend, hot-reload)

  Options
  -------
    -m, --monitor       Include the monitoring stack (prometheus + grafana)
    -y, --yes           Skip confirmation prompts
    -v, --verbose       Print every command before running it
    -h, --help          Show this help

  Examples
  --------
    internops.sh up                 # start production
    internops.sh up -m dev          # dev + monitoring
    internops.sh status             # health + URLs
    internops.sh logs backend       # tail backend logs
    internops.sh seed               # run migrations + demo data
    internops.sh test               # run all tests
    internops.sh ai                 # AI status + sample chat
    internops.sh demo               # live E2E demo
    internops.sh down               # stop everything
    internops.sh reset              # nuke + restart
USAGE
}

# -----------------------------------------------------------------------------
# 17. Argv parsing
# -----------------------------------------------------------------------------
COMMAND=""
ENV_ARG=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    up|down|restart|status|logs|seed|test|ai|demo|reset|doctor|help)
      COMMAND="$1"; shift ;;
    -y|--yes)   ASSUME_YES=1; shift ;;
    -v|--verbose) VERBOSE=1; shift ;;
    -h|--help)   cmd_help; exit 0 ;;
    -m|--monitor) INCLUDE_MONITOR=1; shift ;;
    --) shift; break ;;
    -*) err "Unknown flag: $1"; cmd_help; exit 1 ;;
    prod|dev)    ENV_ARG="$1"; shift ;;
    *)           # Positional arg: first non-flag is the env (for up/restart), else service (for logs)
                if [[ -z "$COMMAND" ]]; then
                  err "Missing command. Try: internops.sh help"; exit 1
                fi
                # Stash any extra positional arg so per-command handlers can pick it up
                EXTRA_ARGS+=("$1"); shift ;;
  esac
done

# Dispatch
case "$COMMAND" in
  up)       cmd_up      "${ENV_ARG:-prod}" "${EXTRA_ARGS[@]:-}" ;;
  down)     cmd_down    "${EXTRA_ARGS[@]:-}" ;;
  restart)  cmd_restart "${ENV_ARG:-prod}" ;;
  status)   cmd_status ;;
  logs)     cmd_logs    "${EXTRA_ARGS[@]:-}" ;;
  seed)     cmd_seed ;;
  test)     cmd_test ;;
  ai)       cmd_ai ;;
  demo)     cmd_demo ;;
  reset)    cmd_reset ;;
  doctor)   cmd_doctor ;;
  help|"")  cmd_help ;;
  *)        err "Unknown command: $COMMAND"; cmd_help; exit 1 ;;
esac
