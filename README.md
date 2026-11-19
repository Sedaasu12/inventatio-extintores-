# SITE - Inventario y trazabilidad de extintores

Aplicación web para registrar cada extintor como un activo individual, consultar su
ubicación actual y conservar el historial de movimientos, inspecciones y servicios.

## Estado del proyecto

**Fases 0 a 5 y bloques 6A/6B implementados y verificados:** modelo de datos,
autenticación y auditoría, ubicaciones y catálogos, alta transaccional de
extintores con QR y etiqueta, carga inicial CSV/JSON con dry-run, motor de
movimientos con baja e historial, ciclo de mantenimiento con servicios y
proyección de vencimientos, e inspecciones con fecha objetivo. Alertas y el
frontend de negocio corresponden a las fases siguientes.

La evidencia completa, con los comandos y su salida real, está en
`docs/evidencias/` y en `docs/plan-implementacion.md`.

| Componente | Tecnología |
|---|---|
| Frontend | Angular 21 + TypeScript |
| Backend | NestJS 11 + TypeScript |
| Base de datos | MySQL 8 |
| ORM | Prisma 6 |

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

Las pruebas de integración y e2e usan una base separada `site_test`, creada y
migrada automáticamente por `backend/test/integration/global-setup.ts`:

```bash
npm run test:integration
npm run test:e2e
```

La URL de pruebas se resuelve así: si defines `TEST_DATABASE_URL`, se usa tal
cual; si no, se deriva de `DATABASE_URL` cambiando el nombre de la base por
`<nombre>_test` (por ejemplo, `site` → `site_test`) y conservando servidor y
credenciales. Sin ninguna de las dos, se usa el valor local
`mysql://site:site@localhost:3307/site_test`.

El administrador para crear la base se deriva del mismo servidor con el usuario
`root` (`TEST_DATABASE_ADMIN_URL` permite cambiarlo). El setup se niega a
ejecutarse si la base de pruebas resuelta se llama `site`.

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
| `GET/POST /api/v1/locations` | Ubicaciones; `tree=true` devuelve la jerarquía |
| `GET/PATCH /api/v1/locations/:id` | Detalle y edición de nombre, dirección o padre |
| `POST /api/v1/locations/:id/deactivate` | Desactivación lógica con validación de dependencias |
| `GET /api/v1/locations/:id/extinguishers` | Inventario de la ubicación o sede |
| `GET/POST /api/v1/extinguisher-types` | Catálogo de tipos de extintor |
| `PATCH /api/v1/extinguisher-types/:id` | Edita/desactiva; recalcula fechas `EQUIPO` |
| `GET/POST /api/v1/external-parties` | Catálogo de proveedores y talleres |
| `GET/PATCH /api/v1/external-parties/:id` | Detalle, edición y desactivación lógica |
| `GET/POST /api/v1/extinguishers` | Listado filtrado y alta transaccional con `Idempotency-Key` |
| `GET /api/v1/extinguishers/by-code/:assetCode` | Resolución de QR o código manual (con rate limit) |
| `GET/PATCH /api/v1/extinguishers/:id` | Ficha completa y edición con `rowVersion` |
| `POST /api/v1/extinguishers/:id/condition` | Cambio de condición técnica con motivo (SEGURIDAD/ADMIN) |
| `GET /api/v1/extinguishers/:id/qr` | QR PNG/SVG del código del activo |
| `GET /api/v1/extinguishers/:id/label` | Etiqueta HTML imprimible |
| `POST /api/v1/extinguishers/imports/dry-run` | Previsualiza una carga inicial CSV/JSON sin escribir datos |
| `POST /api/v1/extinguishers/imports` | Confirma la carga con el comprobante del dry-run |
| `POST /api/v1/extinguishers/:id/movements` | `SALIDA`, `TRASLADO` o `RETORNO_ALMACEN` con `Idempotency-Key` |
| `POST /api/v1/extinguishers/:id/retire` | Baja directa con evidencia obligatoria |
| `POST /api/v1/extinguishers/:id/adjustments` | Ajuste excepcional de colocación (ADMIN) |
| `GET /api/v1/extinguishers/:id/movements` | Historial paginado del activo |
| `GET /api/v1/movements`, `GET /api/v1/movements/:id` | Historial global filtrado y detalle inmutable |
| `GET /api/docs` | Swagger generado en tiempo de ejecución |

El access token se envía como `Authorization: Bearer <token>`. El refresh token
viaja en una cookie `HttpOnly` con `SameSite=Strict`; el frontend no debe
guardarlo en `localStorage`. El administrador sembrado debe cambiar su contraseña
en el primer inicio de sesión.

### Carga inicial

La importación (D-24) exige previsualizar antes de escribir. Ambos endpoints son
`multipart/form-data` y requieren el permiso `extinguishers.create`:

| Campo | Obligatorio | Descripción |
|---|---|---|
| `file` | Sí | CSV o JSON, máximo 5 MB y 10 000 filas, UTF-8. |
| `format` | Sí | `CSV` o `JSON`. |
| `receivedBy` | Sí | Receptor de la carga; se copia al `INGRESO` de cada fila. |
| `documentRef` | Sí | Referencia documental (acta, inventario, correo). |
| `reason` | Sí | Motivo común de los `INGRESO`. |
| `dryRunToken` | Solo al confirmar | Comprobante del dry-run; vence a las 24 h y está ligado al usuario y al archivo. |

Columnas: `serialNumber`, `typeCode`, `brand`, `model`, `capacityValue`,
`capacityUnit`, `manufactureDate`, `acquiredAt`, `commissionedAt`,
`manufacturerExpiryDate`, `sedeCode`, `locationCode`, `technicalCondition`,
`notes`. Son obligatorias `typeCode`, `capacityValue`, `capacityUnit`,
`sedeCode`, `locationCode` y `technicalCondition`.

Ejemplo con `curl`:

```bash
curl -X POST http://localhost:3000/api/v1/extinguishers/imports/dry-run \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@inventario.csv" \
  -F "format=CSV" \
  -F "receivedBy=Carlos Ruiz" \
  -F "documentRef=ACTA-CARGA-2026-001" \
  -F "reason=Carga inicial conciliada con verificación física"
```

La confirmación repite el mismo archivo y campos, añadiendo `dryRunToken`. Cada
fila válida se importa en su propia transacción como `CARGA_INICIAL`; las filas
inválidas se omiten y se reportan. Repetir la confirmación no duplica activos.
El detalle de columnas y reglas está en `docs/diseno-api.md` §4.3.

### Movimientos

`POST /api/v1/extinguishers/:id/movements` acepta `SALIDA`, `TRASLADO` y
`RETORNO_ALMACEN`. Cada petición exige `Idempotency-Key` y el `rowVersion`
actual del extintor:

```json
{
  "type": "SALIDA",
  "originLocationId": "2d9a...",
  "destinationLocationId": "7e4c...",
  "movedAt": "2026-11-10T15:30:00-05:00",
  "requestedBy": "Juan Pérez",
  "deliveredBy": "Juan Pérez",
  "receivedBy": "Carlos Ruiz",
  "reason": "Instalación en sede Lima",
  "documentRef": "ACTA-2026-001",
  "rowVersion": 3
}
```

Reglas aplicadas por el servidor:

- El origen debe coincidir con la colocación actual (`409 ORIGIN_MISMATCH`).
- `SALIDA` solo va de almacén a área; `TRASLADO` solo almacén↔almacén o
  área↔área; `RETORNO_ALMACEN` solo de área a almacén. `TALLER` se reserva para
  mantenimiento.
- Un extintor `NO_OPERATIVO` no puede quedar en un área
  (`422 CONDITION_NOT_ASSIGNABLE`).
- `movedAt` exige zona horaria, no puede superar 5 minutos en el futuro ni ser
  anterior al alta o al último movimiento.
- `authorizedBy` y `documentRef` son opcionales en estos tres movimientos;
  `BAJA` y `AJUSTE` los exigen, junto con el motivo.
- `BAJA` se rechaza si hay una orden de mantenimiento activa. `AJUSTE` es
  exclusivo de `ADMIN`, no cambia la condición técnica y exige
  `correctsMovementId` para reactivar una baja.

El movimiento y la actualización de estado/ubicación se confirman en una sola
transacción con bloqueo de fila y secuencia por activo. Un `rowVersion`
desactualizado responde `409 CONCURRENCY_CONFLICT`; un reintento idéntico
devuelve `200` con `Idempotent-Replay: true`.

### Mantenimiento (fase 6A)

| Endpoint | Uso |
|---|---|
| `POST /api/v1/extinguishers/:id/maintenance/send` | Crea la orden y el `ENVIO_MANTENIMIENTO`. |
| `POST /api/v1/maintenance-orders/:id/services` | Registra un servicio dentro de la orden. |
| `POST /api/v1/extinguishers/:id/services` | Servicio interno sin orden; no cambia colocación ni estado. |
| `POST /api/v1/maintenance-orders/:id/return` | `RETORNO_MANTENIMIENTO` y cierre de la orden. |
| `GET /api/v1/maintenance-orders` | Lista con filtros por estado, proveedor, taller, activo y retorno previsto. |
| `GET /api/v1/maintenance-orders/:id` | Orden con sus servicios. |

Reglas aplicadas por el servidor:

- La orden nace en `EN_PROVEEDOR` para proveedor externo o taller interno; solo
  puede existir una orden activa por extintor (`409 MAINTENANCE_ORDER_ACTIVE`).
- El envío externo exige `documentRef`; el taller interno debe ser una ubicación
  activa de tipo `TALLER`.
- El retorno exige al menos un servicio (`422 MAINTENANCE_SERVICE_REQUIRED`),
  que el extintor siga en el proveedor/taller de la orden y un destino activo
  `ALMACEN` o `AREA`.
- En una orden externa el `providerId` del servicio debe coincidir con el de la
  orden; en una orden interna `performedByUserId` es obligatorio.
- `performedAt` exige zona horaria, no puede superar 5 minutos en el futuro ni
  ser anterior al alta o a la apertura de la orden. `nextDueDate` debe ser
  posterior a la fecha local del hecho.
- Cada servicio actualiza solo su categoría de vencimiento y no reemplaza una
  fecha más reciente. El resultado del servicio es evidencia y no cambia la
  condición técnica ni la ubicación.
- Costo y moneda son opcionales y coherentes entre sí; no se asume moneda por
  defecto.

### Inspecciones (fase 6B)

| Endpoint | Uso |
|---|---|
| `POST /api/v1/extinguishers/:id/inspections` | Registra la inspección y actualiza la fecha objetivo `INSPECCION`. |
| `GET /api/v1/inspections` | Lista con filtros por extintor, código, resultado y rango de fecha. |
| `GET /api/v1/inspections/:id` | Detalle de la inspección. |

Reglas aplicadas por el servidor:

- La escritura exige `Idempotency-Key`; un reintento idéntico responde `200`
  con `Idempotent-Replay: true`.
- `inspectedAt` exige zona horaria y no puede superar 5 minutos en el futuro ni
  ser anterior al alta. `inspectedOn` se deriva en `America/Lima` y no lo envía
  el cliente. `nextDueDate` debe ser posterior a `inspectedOn`.
- El `checklist` es un objeto JSON libre de hasta 20 KB; no se impone un
  catálogo reglamentario.
- El resultado es evidencia: no cambia la condición técnica (D-28), el estado
  logístico, la colocación ni `rowVersion`.
- Cada inspección reemplaza solo la categoría `INSPECCION` y no reemplaza una
  fecha más reciente.
- La ficha del extintor incluye `lastInspection` y `openMaintenanceOrder`.

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
backend/          NestJS: API REST, autenticación, catálogos, extintores, importación, movimientos, mantenimiento e inspecciones
frontend/         Angular: esqueleto con routing
docs/             Visión, requerimientos, reglas, modelo, API y evidencias
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
- Las acciones sensibles requieren autenticación y permisos basados en roles.
- No se almacenan secretos en el repositorio ni en el frontend.
- La aplicación ayuda a controlar registros y avisos; no sustituye inspecciones,
  certificados ni criterios del personal competente.
