#!/usr/bin/env sh
set -e
log(){ echo "[restart-bot] $*"; }

# где лежит compose-проект внутри контейнера app
PROJ_DIR="${PROJ_DIR:-/project}"
# env-файл для сервиса bot
BOT_ENV_FILE="${BOT_ENV_FILE:-/project/bot-config/bot.env}"
# имя сервиса бота в docker-compose.yml
COMPOSE_SERVICE_BOT="${COMPOSE_SERVICE_BOT:-bot}"

# если /project недоступен (например, другой путь монтирования), пробуем взять каталог скрипта
if [ ! -d "$PROJ_DIR" ]; then
  SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
  PROJ_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
  log "PROJ_DIR fallback to $PROJ_DIR"
fi

# выбираем доступную команду compose
if docker compose version >/dev/null 2>&1; then
  COMPOSE_BIN="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_BIN="docker-compose"
else
  log "ERROR: docker compose/ docker-compose не найдены"
  exit 1
fi

TOKEN="$TELEGRAM_BOT_TOKEN"
ACTION="${TELEGRAM_BOT_ACTION:-restart}"
FULL_RESTART="${RESTART_ALL_ON_TOKEN_CHANGE:-1}"

log "action=$ACTION full_restart=$FULL_RESTART"

[ -n "$TOKEN" ] || { log "ERROR: TELEGRAM_BOT_TOKEN is empty"; exit 1; }
command -v docker >/dev/null 2>&1 || { log "ERROR: docker CLI not found"; exit 1; }

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
  log "full stack restart (rebuild app+bot)"
  $COMPOSE_BIN down --remove-orphans || true
  $COMPOSE_BIN up -d --build
else
  log "stopping old bot container (if any)"
  $COMPOSE_BIN stop "$COMPOSE_SERVICE_BOT" >/dev/null 2>&1 || true
  log "removing old bot container (if any)"
  $COMPOSE_BIN rm -f "$COMPOSE_SERVICE_BOT" >/dev/null 2>&1 || true
  log "rebuilding & starting bot with new token"
  $COMPOSE_BIN up -d --build "$COMPOSE_SERVICE_BOT"
fi

log "done"
