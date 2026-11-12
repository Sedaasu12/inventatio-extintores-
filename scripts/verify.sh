#!/usr/bin/env bash
# Verificación de la fase 0. Ejecuta lint, typecheck, pruebas y build reales.
# Uso: ./scripts/verify.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi
export DATABASE_URL="${DATABASE_URL:-mysql://site:site@localhost:3306/site}"

echo "== Backend =="
cd backend
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
npm run prisma:validate

echo "== Frontend =="
cd ../frontend
npm run lint
npm run typecheck
npm run test:ci
npm run build

echo "Verificación completada."
