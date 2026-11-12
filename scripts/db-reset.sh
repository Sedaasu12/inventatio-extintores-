#!/usr/bin/env bash
# Elimina el volumen de MySQL y recrea el contenedor vacío.
# ¡Borra todos los datos de desarrollo! Uso: ./scripts/db-reset.sh --yes
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ "${1:-}" != "--yes" ]; then
  read -r -p "Esto borrará la base de datos de desarrollo. Escribe 'si' para continuar: " answer
  if [ "$answer" != "si" ]; then
    echo "Cancelado."
    exit 1
  fi
fi

docker compose down -v
docker compose up -d mysql
echo "MySQL recreado. Espera a que el healthcheck esté en 'healthy' antes de conectar."
