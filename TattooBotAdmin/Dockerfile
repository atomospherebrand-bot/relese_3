# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
# нужен docker-cli, чтобы скрипт мог делать `docker compose up -d bot`
RUN apk add --no-cache docker-cli bash curl
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=6050
EXPOSE 6050
CMD ["node", "dist/index.js"]
