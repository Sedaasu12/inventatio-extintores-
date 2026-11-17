# SITE - Inventario y trazabilidad de extintores

Aplicación web para registrar cada extintor como un activo individual, consultar su
ubicación actual y conservar el historial de movimientos, inspecciones y servicios.

## Estado del proyecto

**Fase 0 implementada y verificada:** esqueleto del repositorio, tooling, CI y
base de datos comprobados. No hay modelos de datos, autenticación, CRUD, QR ni
pantallas de negocio todavía.

La evidencia completa, con los comandos y su salida real, está en
`docs/evidencias/fase-0.md`.

| Componente | Tecnología |
|---|---|
| Frontend | Angular 21 + TypeScript |
| Backend | NestJS 11 + TypeScript |
| Base de datos | MySQL 8 |
| ORM | Prisma 6 (sin modelos en fase 0) |

## Requisitos

- Node.js 22.17 o superior dentro de la línea 22 (el CLI de Nest 12 exige 22.22.3;
  este repositorio usa Nest 11 para no bloquear el entorno actual).
- npm 10 o superior.
- Docker Desktop con Compose v2 (opcional si usas un MySQL local).

## Instalación

```bash
# Backend
cd backend
npm ci

# Frontend
cd ../frontend
npm ci
```

El frontend incluye `.npmrc` con `legacy-peer-deps=true` porque Angular 21 y
Vitest 4 declaran peers que npm 10 no resuelve sin ese ajuste.

## Base de datos

> Requisito en Windows: Docker Desktop necesita WSL2 con la «Plataforma de máquina
> virtual» habilitada. Sin eso, el motor no inicia (`HCS_E_HYPERV_NOT_INSTALLED`).

```bash
# Desde la raíz del repositorio
docker compose up -d mysql
```

El contenedor crea la base `site` con el usuario `site`. La cadena de conexión de
ejemplo está en `.env.example`.

Si el puerto 3306 ya está ocupado (por ejemplo, por un MySQL local), define
`MYSQL_PORT=3307` y usa `mysql://site:site@localhost:3307/site` en tu `.env`.
En este equipo quedó así y la conexión se verificó con MySQL 8.4.13.

Para detener y eliminar los datos:

```bash
docker compose down -v
```

### Migraciones y datos de desarrollo

```bash
cd backend
# Aplica las migraciones versionadas (no borra datos)
npm run db:migrate

# Carga datos ficticios de desarrollo; es idempotente
npm run db:seed
```

La semilla crea el usuario `admin@site.local`. Si no defines
`SEED_ADMIN_PASSWORD`, se genera una contraseña temporal y se muestra una sola vez
en la consola; el administrador debe cambiarla en el primer inicio de sesión.

Las pruebas de integración usan una base separada `site_test`, creada y migrada
automáticamente por `backend/test/integration/global-setup.ts`:

```bash
npm run test:integration
```

El setup se niega a ejecutarse si `TEST_DATABASE_URL` apunta a `site`. Para usar
otra base u otro administrador, define `TEST_DATABASE_URL` y
`TEST_DATABASE_ADMIN_URL`.

## Ejecución en desarrollo

```bash
# Backend (http://localhost:3000/api/v1)
cd backend
npm run start:dev

# Frontend (http://localhost:4200)
cd ../frontend
npm start
```

Endpoints disponibles:

| Ruta | Descripción |
|---|---|
| `GET /api/v1/health` | Estado del servicio (público) |
| `POST /api/v1/auth/login` | Inicio de sesión (correo y contraseña) |
| `POST /api/v1/auth/refresh` | Rotación del refresh token |
| `POST /api/v1/auth/logout` | Cierre de sesión |
| `GET /api/v1/auth/me` | Perfil, roles y permisos efectivos |
| `POST /api/v1/auth/change-password` | Cambio de contraseña propio |
| `GET/POST /api/v1/users` | Consulta y alta de usuarios |
| `GET /api/v1/roles`, `GET /api/v1/permissions` | Catálogos de autorización |
| `PUT /api/v1/roles/:id/permissions` | Matriz de permisos del rol |
| `GET /api/v1/audit-logs` | Auditoría (requiere `audit.read`) |
| `GET /api/docs` | Swagger generado en tiempo de ejecución |

El access token se envía como `Authorization: Bearer <token>`. El refresh token
viaja en una cookie `HttpOnly` con `SameSite=Strict`; el frontend no debe
guardarlo en `localStorage`. El administrador sembrado debe cambiar su contraseña
en el primer inicio de sesión.

## Verificación

Desde la raíz:

```bash
# Windows (PowerShell)
./scripts/verify.ps1

# Linux/macOS/Git Bash
./scripts/verify.sh
```

Cada comando se ejecuta de verdad; no se reporta una prueba como exitosa sin su
salida. La evidencia de la fase 0 está en `docs/evidencias/fase-0.md`.

## Estructura

```text
backend/          NestJS: configuración validada y módulo health
frontend/         Angular: esqueleto con routing
docs/             Visión, requerimientos, reglas, modelo y evidencias
scripts/          Verificación y reset de base de datos
.github/          CI con lint, typecheck, pruebas y build
```

## Documentación

- `docs/00-vision-y-alcance.md` — alcance y objetivos.
- `docs/decisiones-pendientes.md` — registro de decisiones aprobadas y abiertas.
- `docs/reglas-de-negocio.md` — reglas del negocio.
- `docs/modelo-entidad-relacion.md` — modelo de datos propuesto.
- `docs/diseno-api.md` — contratos de la API.
- `docs/plan-implementacion.md` — fases de implementación.
- `docs/plan-de-pruebas.md` — estrategia y casos de prueba.

## Seguridad y alcance

- El QR solo identifica el activo; escanearlo no concede acceso.
- Las acciones sensibles requieren autenticación y permisos (fases posteriores).
- No se almacenan secretos en el repositorio ni en el frontend.
- La aplicación ayuda a controlar registros y avisos; no sustituye inspecciones,
  certificados ni criterios del personal competente.
