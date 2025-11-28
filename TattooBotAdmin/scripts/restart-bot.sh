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

[ -n "$TOKEN" ] || { log "ERROR: TELEGRAM_BOT_TOKEN is empty"; exit 1; }
command -v docker >/dev/null 2>&1 || { log "ERROR: docker CLI not found"; exit 1; }

# пишем токен в env-файл, чтобы bot его подхватил через env_file
mkdir -p "$(dirname "$BOT_ENV_FILE")"
printf "TELEGRAM_BOT_TOKEN=%s\n" "$TOKEN" > "$BOT_ENV_FILE"
log "wrote token to $BOT_ENV_FILE"

# запускаем/пересобираем ИМЕННО сервис bot (в его же сети compose)
cd "$PROJ_DIR"
log "stopping old bot container (if any)"
$COMPOSE_BIN stop "$COMPOSE_SERVICE_BOT" >/dev/null 2>&1 || true
log "removing old bot container (if any)"
$COMPOSE_BIN rm -f "$COMPOSE_SERVICE_BOT" >/dev/null 2>&1 || true
log "rebuilding & starting bot with new token"
$COMPOSE_BIN up -d --build "$COMPOSE_SERVICE_BOT"

log "done"
