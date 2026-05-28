#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")/.."

if [ ! -f deploy/.env ]; then
  cp deploy/.env.example deploy/.env
  echo "Created deploy/.env from deploy/.env.example. Review it before exposing the service publicly."
fi

docker compose -f deploy/docker-compose.yml --env-file deploy/.env build
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d
docker compose -f deploy/docker-compose.yml --env-file deploy/.env ps
