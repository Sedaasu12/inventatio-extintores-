# Verificación del proyecto. Ejecuta lint, typecheck, pruebas y build reales.
# Requiere MySQL en marcha y un .env con DATABASE_URL.
# Uso: ./scripts/verify.ps1
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
            $name, $value = $line.Split('=', 2)
            [Environment]::SetEnvironmentVariable($name.Trim(), $value.Trim(), 'Process')
        }
    }
}
if (-not $env:DATABASE_URL) {
    $env:DATABASE_URL = 'mysql://site:site@localhost:3306/site'
}

function Invoke-Step {
    param([string]$Name, [scriptblock]$Action)
    Write-Host ">> $Name"
    # Jest y otras herramientas escriben su resumen en stderr; con
    # ErrorActionPreference=Stop PowerShell lo trataría como excepción.
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $Action 2>&1 | ForEach-Object { Write-Host $_ }
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previous
    }
    if ($code -ne 0) {
        throw "Falló: $Name (código $code)"
    }
}

Write-Host '== Backend =='
Set-Location backend
Invoke-Step 'lint' { npm run lint }
Invoke-Step 'typecheck' { npm run typecheck }
Invoke-Step 'test' { npm run test }
Invoke-Step 'test:e2e' { npm run test:e2e }
Invoke-Step 'test:integration' { npm run test:integration }
Invoke-Step 'build' { npm run build }
Invoke-Step 'prisma:validate' { npm run prisma:validate }

Write-Host '== Frontend =='
Set-Location ../frontend
Invoke-Step 'lint' { npm run lint }
Invoke-Step 'typecheck' { npm run typecheck }
Invoke-Step 'test:ci' { npm run test:ci }
Invoke-Step 'build' { npm run build }

Write-Host 'Verificación completada.'
