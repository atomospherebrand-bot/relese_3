#!/usr/bin/env sh
set -e
DEFAULT_LOG="/project/data/restart-bot.log"
LOG_FILE="${RESTART_BOT_LOG:-$DEFAULT_LOG}"
TEE_LOG_FILE="${RESTART_BOT_TEE_LOG:-""}"

log(){
  echo "[restart-bot] $*"
  # дублируем в файл для пост-мортем диагностики
  if [ -n "$LOG_FILE" ]; then
    mkdir -p "$(dirname "$LOG_FILE")" || true
    echo "[restart-bot] $*" >>"$LOG_FILE" || true
  fi
  if [ -n "$TEE_LOG_FILE" ]; then
    mkdir -p "$(dirname "$TEE_LOG_FILE")" || true
    echo "[restart-bot] $*" >>"$TEE_LOG_FILE" || true
  fi
}

trap 'log "exit code $?"' EXIT

# где лежит compose-проект внутри контейнера app
PROJ_DIR="${PROJ_DIR:-/project}"
# env-файл для сервиса bot
BOT_ENV_FILE="${BOT_ENV_FILE:-/project/bot-config/bot.env}"
# имя сервиса бота в docker-compose.yml
COMPOSE_SERVICE_BOT="${COMPOSE_SERVICE_BOT:-bot}"
COMPOSE_SERVICE_APP="${COMPOSE_SERVICE_APP:-app}"

# если /project недоступен (например, другой путь монтирования), пробуем взять каталог скрипта
if [ ! -d "$PROJ_DIR" ]; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  PROJ_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
  log "PROJ_DIR fallback to $PROJ_DIR"
fi

log "project dir: $PROJ_DIR"
if [ ! -d "$PROJ_DIR" ]; then
  log "ERROR: project dir not found"
  exit 1
fi
log "project dir entries: $(ls -1 "$PROJ_DIR" | head -n 20 | tr '\n' ' ')"

SELF_CONTAINER="$(hostname 2>/dev/null || true)"

# выбираем доступную команду compose
if docker compose version >/dev/null 2>&1; then
  COMPOSE_BIN="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_BIN="docker-compose"
else
  log "ERROR: docker compose/ docker-compose не найдены"
  exit 1
fi

log "compose bin: $COMPOSE_BIN"
if ! $COMPOSE_BIN version >/dev/null 2>&1; then
  log "ERROR: compose version command failed"
  exit 1
fi

TOKEN="$TELEGRAM_BOT_TOKEN"
ACTION="${TELEGRAM_BOT_ACTION:-restart}"
FULL_RESTART="${RESTART_ALL_ON_TOKEN_CHANGE:-1}"

log "action=$ACTION full_restart=$FULL_RESTART token_len=${#TOKEN}"

[ -n "$TOKEN" ] || { log "ERROR: TELEGRAM_BOT_TOKEN is empty"; exit 1; }
command -v docker >/dev/null 2>&1 || { log "ERROR: docker CLI not found"; exit 1; }
if ! docker info >/dev/null 2>&1; then
  log "ERROR: docker daemon unreachable (check /var/run/docker.sock)"
  exit 1
fi

run_compose(){
  CMD="$COMPOSE_BIN $*"
  log "compose: $CMD"
  # пишем и в лог, и в stdout, чтобы было видно в контейнерных логах
  if ! sh -c "$CMD" 2>&1 | tee -a "$LOG_FILE"; then
    log "ERROR: compose command failed (see $LOG_FILE)"
    exit 1
  fi
}

# пишем токен в env-файл, чтобы bot его подхватил через env_file
mkdir -p "$(dirname "$BOT_ENV_FILE")"
printf "TELEGRAM_BOT_TOKEN=%s\n" "$TOKEN" > "$BOT_ENV_FILE"
log "wrote token to $BOT_ENV_FILE"

# запускаем/пересобираем сервисы
cd "$PROJ_DIR"

# чистим контейнер с фиксированным именем (в обход compose, чтобы избежать код 125 от docker run)
if docker ps -a --format '{{.Names}}' | grep -q "^tatto_bot_host$"; then
  log "force removing container tatto_bot_host"
  docker rm -f tatto_bot_host >/dev/null 2>&1 || true
fi

if [ "$FULL_RESTART" = "1" ] && [ "$ACTION" != "stop" ]; then
  log "full stack restart requested (force-recreate without down)"
  run_compose up -d --build --force-recreate "$COMPOSE_SERVICE_BOT"
  run_compose up -d --build --force-recreate nginx-proxy nginx-proxy-acme db || true
  if [ "$SELF_CONTAINER" = "$COMPOSE_SERVICE_APP" ]; then
    log "skipping app recreate because running inside $SELF_CONTAINER"
  else
    run_compose up -d --build --force-recreate "$COMPOSE_SERVICE_APP"
  fi
else
  log "stopping old bot container (if any)"
  run_compose stop "$COMPOSE_SERVICE_BOT" || true
  log "removing old bot container (if any)"
  run_compose rm -f "$COMPOSE_SERVICE_BOT" || true
  log "rebuilding & starting bot with new token (force recreate)"
  run_compose up -d --build --force-recreate "$COMPOSE_SERVICE_BOT"
fi

log "done"
