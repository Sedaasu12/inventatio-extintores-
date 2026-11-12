# Evidencia de la fase 0

**Fecha de ejecución:** 2026-11-11/12 (hora local `America/Lima`).
**Alcance:** esqueleto del repositorio, tooling, CI y verificación. Sin modelos,
migraciones, autenticación, CRUD, QR ni pantallas de negocio.

## Entorno

| Herramienta | Versión |
|---|---|
| Node.js | v22.17.1 |
| npm | 10.9.2 |
| Docker | 28.3.2 (build 578ccf6) |
| Docker Compose | v2.38.2-desktop.1 |
| Git | 2.50.1.windows.1 |
| NestJS CLI | 11.x |
| Angular CLI | 21.x |

## Comandos ejecutados y resultado

### Instalación reproducible

| Comando | Directorio | Resultado |
|---|---|---|
| `npm ci` | `backend/` | 726 paquetes instalados; 31 vulnerabilidades reportadas por npm |
| `npm ci` | `frontend/` | 589 paquetes instalados; 25 vulnerabilidades moderadas reportadas por npm |

### Backend

| Comando | Resultado |
|---|---|
| `npm run lint` | Sin errores |
| `npm run typecheck` | Sin errores |
| `npm run test` | 1 suite, 6 pruebas aprobadas |
| `npm run test:e2e` | 1 suite, 2 pruebas aprobadas |
| `npm run build` | Compilación correcta (`dist/`) |
| `npm run prisma:validate` | «The schema at prisma/schema.prisma is valid» |
| `npm run prisma:generate` | Prisma Client 6.19.3 generado |

### Frontend

| Comando | Resultado |
|---|---|
| `npm run lint` | «All files pass linting» |
| `npm run typecheck` | Sin errores (`tsconfig.app.json` y `tsconfig.spec.json`) |
| `npm run test:ci` | 1 archivo, 2 pruebas aprobadas (Vitest 4.1.12) |
| `npm run build` | Compilación correcta; bundle inicial 187.62 kB |

### Verificación integrada

`powershell -ExecutionPolicy Bypass -File scripts/verify.ps1` ejecutó todos los
comandos anteriores y terminó con «Verificación completada.»

### Servicio en ejecución

```text
GET http://localhost:3000/api/v1/health
HTTP 200
{"status":"ok","service":"site-backend","environment":"development","timestamp":"2026-11-12T03:46:31.687Z","uptimeSeconds":3}
```

El backend se detuvo después de la comprobación. Swagger queda disponible en
`/api/docs` al iniciar el servicio.

### Base de datos MySQL

**Verificada el 2026-11-12.** La virtualización se habilitó y Docker Desktop
inició su motor Linux correctamente.

Incidencias resueltas durante la verificación:

1. Antes de habilitar la virtualización, WSL2 fallaba con
   `HCS_E_HYPERV_NOT_INSTALLED`. Tras habilitarla y reiniciar, `wsl -d docker-desktop -e echo OK`
   respondió `OK`.
2. El puerto 3306 del equipo ya estaba ocupado por un MySQL local
   (`mysqld` 8.0). Se publicó el contenedor en 3307 mediante `MYSQL_PORT=3307`,
   sin tocar el servicio local.
3. El contenedor `site-mysql` arrancó y alcanzó `health=healthy`.
4. La conexión se validó con Prisma:

```text
$ docker compose ps
site-mysql  mysql:8.4  Up (healthy)  0.0.0.0:3307->3306/tcp

$ docker exec site-mysql mysql -usite -psite -N -e "SELECT VERSION();" site
8.4.13

$ DATABASE_URL=mysql://site:site@localhost:3307/site
  npx prisma db execute --stdin --schema prisma/schema.prisma
  <<< 'SELECT 1;'
Script executed successfully.
```

**Estado:** criterio aprobado. El `.env` local (no versionado) apunta a 3307; el
`.env.example` conserva 3306 como valor por defecto y documenta el cambio de
puerto cuando esté ocupado.

## Vulnerabilidades reportadas

No se aplicó `npm audit fix --force` porque introduce cambios mayores incompatibles.

| Proyecto | Total | Detalle |
|---|---|---|
| Backend | 31 (5 low, 23 moderate, 3 high) | Las 3 altas provienen del CLI de Prisma (`deepmerge-ts` transitivo); la corrección propuesta exige Prisma 7, cambio mayor. |
| Frontend (producción) | 0 | `npm audit --omit=dev` sin hallazgos. |
| Frontend (total) | 25 moderate | Herramientas de desarrollo: `glob`, `minimatch`, `eslint` y `@angular/cli`; la corrección propuesta es un cambio mayor. |

## Desviaciones y notas

- **NestJS CLI 11** en lugar de la última versión: Nest CLI 12 exige Node
  `^22.22.3 || ^24.15.0 || >=26.0.0` y el entorno tiene 22.17.1.
- **Angular 21 con `--legacy-peer-deps`**: npm 10 no resuelve los peers de
  Angular 21 + Vitest 4; queda fijado en `frontend/.npmrc` para que `npm ci`
  sea reproducible.
- **MySQL 8.4 LTS** en lugar de 8.0, que ya está fuera de soporte. Sigue siendo
  MySQL 8.
- **`entry_source`**: el enum incluye `RETORNO_MANTENIMIENTO` y `TRASLADO`,
  aunque un `INGRESO` solo ocurre en el alta. Se revisará en la fase 1.
- El repositorio no tenía Git inicializado; se inicializó para el primer commit
  de la fase 0.
