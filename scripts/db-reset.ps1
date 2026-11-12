# Elimina el volumen de MySQL y recrea el contenedor vacío.
# ¡Borra todos los datos de desarrollo! Uso: ./scripts/db-reset.ps1 -Yes
param(
    [switch]$Yes
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $Yes) {
    $answer = Read-Host "Esto borrará la base de datos de desarrollo. Escribe 'si' para continuar"
    if ($answer -ne 'si') {
        Write-Host 'Cancelado.'
        exit 1
    }
}

docker compose down -v
docker compose up -d mysql
Write-Host "MySQL recreado. Espera a que el healthcheck esté en 'healthy' antes de conectar."
