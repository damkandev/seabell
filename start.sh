#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "Docker Desktop con Docker Compose es requerido para el arranque local." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker Desktop debe estar abierto y ejecutándose." >&2
  exit 1
fi

export DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5433/seabell}"
export COOKIE_SECURE="${COOKIE_SECURE:-false}"

docker compose up -d postgres
until docker compose exec -T postgres pg_isready -U postgres -d seabell >/dev/null 2>&1; do
  sleep 1
done

pnpm db:migrate
exec pnpm dev
