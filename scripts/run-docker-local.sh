#!/bin/bash

set -eo pipefail

SCRIPT_DIR=$(dirname "$0")

cd "${SCRIPT_DIR}/.."

docker compose -f docker-compose.local.yml build
CLIENT_IMAGE=webshot-roulette/client:local \
  SERVER_IMAGE=webshot-roulette/server:local \
  docker compose -f docker-compose.yml up
