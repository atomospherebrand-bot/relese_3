# Развёртывание через Docker Compose

## Предварительные требования
- Docker
- Docker Compose v2

## Запуск
```bash
sudo docker compose up --build -d
```

Команда соберёт образ приложения, поднимет контейнеры `app` и `db` и автоматически применит миграции базы данных. После старта веб-админка будет доступна на `http://<ваш_сервер>:6050`.

## Остановка
```bash
sudo docker compose down
```

## Полезные команды
- Просмотр логов приложения: `sudo docker compose logs -f app`
- Просмотр логов PostgreSQL: `sudo docker compose logs -f db`
- Пересборка после изменений: `sudo docker compose up --build -d`

## Переменные окружения
По умолчанию используются следующие значения:
- `DATABASE_URL=postgres://tattoo:tattoo@db:5432/tattoo`
- `PORT=6050`
- `NODE_ENV=production`

При необходимости можно переопределить их в `docker-compose.yml` или через `.env` файл Docker Compose.
