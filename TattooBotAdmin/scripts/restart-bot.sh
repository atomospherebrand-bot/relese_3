#!/usr/bin/env sh
set -e
log(){ echo "[restart-bot] $*"; }

# где лежит compose-проект внутри контейнера app
DEFAULT_PROJ_DIR="/project"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if [ -d "${PROJ_DIR:-$DEFAULT_PROJ_DIR}" ]; then
  PROJ_DIR="${PROJ_DIR:-$DEFAULT_PROJ_DIR}"
else
  PROJ_DIR="${PROJ_DIR:-$SCRIPT_DIR/..}"
fi

# env-файл для сервиса bot
BOT_ENV_FILE="${BOT_ENV_FILE:-$PROJ_DIR/bot-config/bot.env}"
# имя сервиса бота в docker-compose.yml
COMPOSE_SERVICE_BOT="${COMPOSE_SERVICE_BOT:-bot}"

TOKEN="$TELEGRAM_BOT_TOKEN"

[ -n "$TOKEN" ] || { log "ERROR: TELEGRAM_BOT_TOKEN is empty"; exit 1; }
command -v docker >/dev/null 2>&1 || { log "ERROR: docker CLI not found"; exit 1; }

# пишем токен в env-файл, чтобы bot его подхватил через env_file
mkdir -p "$(dirname "$BOT_ENV_FILE")"
printf "TELEGRAM_BOT_TOKEN=%s\n" "$TOKEN" > "$BOT_ENV_FILE"
log "wrote token to $BOT_ENV_FILE"

# запускаем/пересобираем ИМЕННО сервис bot (в его же сети compose)
cd "$PROJ_DIR"

# останавливаем предыдущий контейнер, чтобы не висел старый токен
docker compose rm -sf "$COMPOSE_SERVICE_BOT" >/dev/null 2>&1 || true
docker compose up -d --force-recreate --build "$COMPOSE_SERVICE_BOT"

log "done"
