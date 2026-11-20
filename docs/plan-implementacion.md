# Plan de implementación por fases — SITE

> **Estado:** propuesta para aprobación. **No se inicia ninguna fase de código de producción hasta que el propietario apruebe el análisis, los documentos y las decisiones bloqueantes.**
>
> **Principio:** cada fase es un corte vertical pequeño, verificable y con pruebas. No se implementa “todo el backend” ni “todo el frontend” de una vez. Cada fase termina con lint, typecheck, pruebas, build y evidencia real.

---

## 1. Estrategia

1. **Primero decisiones y entorno; luego datos; luego backend; luego frontend; luego E2E.**
2. **La base de datos y las reglas transaccionales se estabilizan antes de la UI.**
3. **Cada fase produce algo demostrable:** un endpoint probado, una pantalla conectada a la API real, un flujo E2E.
4. **No se avanza con pruebas rojas o no ejecutadas.** Si una prueba no existe, se dice y se crea.
5. **Los datos de desarrollo son ficticios y están separados de producción.**
6. **Los cambios de alcance se registran y se reestiman.**

---

## 2. Resumen de fases

| Fase | Nombre | Depende de | Esfuerzo relativo | Entregable principal |
|---|---|---|---:|---|
| 0 | Preparación, decisiones y entorno | Aprobación de documentos | S | Repositorio, apps vacías, CI, configuración, MySQL. |
| 1 | Modelo de datos y migración inicial | Fase 0 + D-01/02/15/26 | M | Esquema Prisma, migración, constraints, seed. |
| 2 | Autenticación, RBAC y auditoría base | Fase 1 + D-06/07/27 | M | Login, refresh, permisos, auditoría. |
| 3 | Ubicaciones y catálogos | Fase 2 + D-02 | M | CRUD de sedes y de sus almacenes, taller y áreas (dos niveles), tipos y proveedores. |
| 4 | Extintores, código, QR y alta inicial | Fase 3 + D-03/04/05/16/26b | L | Ficha, código, QR, etiqueta, `INGRESO` inicial. |
| 5 | Motor de movimientos | Fase 4 + D-08/08b/09/13/17/26b | L | Salida, traslado, retorno, baja, ajuste, historial. |
| 6 | Mantenimiento, inspecciones y fechas | Fase 5 + D-10/13/18/28 | L | Órdenes, servicios, retornos, inspecciones, `due_dates`. |
| 7 | Alertas, dashboard y reportes | Fase 6 + D-11/12/19 | M | Alertas, umbrales, resumen, reportes y CSV. |
| 8 | Frontend: base, login y shell | Fase 2 + Fase 7 (API estable) | M | Login, layout, guards, API client, accesibilidad base. |
| 9 | Frontend: inventario y QR | Fase 8 + Fase 4 | L | Lista, ficha, alta, escaneo, etiqueta. |
| 10 | Frontend: operaciones y administración | Fase 9 + Fases 5–7 | L | Movimientos, mantenimiento, inspecciones, alertas, reportes, admin. |
| 11 | Operación sin conexión (PWA) | Fase 10 + D-14 | L | Caché de lectura, borradores cifrados, sincronización y conflictos. |
| 12 | E2E, seguridad, rendimiento y despliegue | Fase 11 | L | Suite completa, hardening, backups, runbook. |

**MVP demostrable:** fases 0–11. **Listo para producción:** fase 12 aprobada.

---

## 3. Fase 0 — Preparación, decisiones y entorno

### Objetivo

Crear un repositorio limpio, reproducible y verificable, con las decisiones bloqueantes registradas, antes de escribir reglas de negocio.

### Dependencias

- Aprobación de la documentación de análisis (2026-11-10).
- **Solo D-01 (single-tenant) y D-15 (zona horaria)** para la configuración inicial. Las decisiones D-03, D-04, D-05, D-07, D-09, D-10, D-16, D-17, D-18, D-24 y D-31 ya fueron aprobadas y se aplican en sus fases.
- El ajuste de dependencias fue autorizado por el propietario el 2026-11-10.

### Alcance

- Inicializar Git y `.gitignore` (incluir `.env`, `node_modules`, `dist`, artefactos).
- Estructura `backend/`, `frontend/`, `docs/`, `scripts/`.
- Backend NestJS con TypeScript estricto, lint, typecheck, test, build y health check.
- Frontend Angular con standalone components, lint, typecheck, test, build.
- MySQL 8 local y/o `docker-compose.yml` opcional; documentar ambas rutas.
- `.env.example` con nombres de variables y valores ficticios.
- CI (GitHub Actions u equivalente) con lint, typecheck, test, build, validación del esquema Prisma y comprobación de conexión a MySQL. La migración desde cero se ejecutará cuando existan modelos (fase 1).
- Swagger base y documento OpenAPI inicial.
- `docs/evidencias/` para registrar ejecuciones.
- Registrar decisiones aprobadas en `decisiones-pendientes.md`.

### Archivos esperados

```text
.gitignore
README.md
docker-compose.yml
.env.example
scripts/
  db-reset.sh
  verify.sh
backend/
  package.json
  tsconfig.json
  nest-cli.json
  eslint.config.*
  src/main.ts
  src/app.module.ts
  src/modules/health/
  test/
frontend/
  package.json
  angular.json
  tsconfig.json
  src/app/app.config.ts
  src/app/app.routes.ts
  src/app/features/auth/login/
docs/
  evidencias/
  api/openapi.yaml
```

### Criterios de aceptación

- `git status` limpio después del primer commit.
- Backend y frontend compilan desde cero.
- `GET /api/v1/health` responde 200.
- MySQL 8 responde y la conexión se configura por `.env`.
- CI ejecuta lint, typecheck, test y build sin secretos.
- No hay contraseñas, tokens ni datos reales en el repositorio.
- Versiones exactas registradas en `package.json`/`package-lock.json`.
- Decisiones aprobadas documentadas con fecha y responsable.

### Estado de ejecución (2026-11-11)

Implementado y verificado: estructura, backend, frontend, `docker-compose.yml`,
`.env.example`, scripts, CI, Swagger/OpenAPI y evidencias. Pasaron lint, typecheck,
pruebas unitarias, pruebas e2e, build y `prisma validate` en ambos proyectos;
`GET /api/v1/health` respondió 200; MySQL 8.4.13 arrancó en Docker con
`health=healthy` y la conexión se validó con `prisma db execute`.

Nota de entorno: el puerto 3306 estaba ocupado por un MySQL local, así que el
contenedor se publicó en 3307 mediante `MYSQL_PORT`. Evidencia completa en
`docs/evidencias/fase-0.md`.

### Pruebas

- Smoke test de health.
- Build de backend y frontend.
- Test trivial de configuración.
- Validación de que `.env` no está versionado.

### Riesgos

| Riesgo | Mitigación |
|---|---|
| Versiones incompatibles (Node/Angular/Nest/Prisma) | Verificar matriz de compatibilidad al crear; fijar versiones; CI. |
| Entorno Windows/Linux distinto | Scripts documentados; CI en Linux; no depender de rutas absolutas. |
| Fuga de secretos | `.gitignore`; `.env.example`; revisión antes del commit. |
| CI sin MySQL | Servicio MySQL 8 en CI o testcontainers. |

### Verificación

```bash
# Backend
npm run lint && npm run typecheck && npm run test && npm run build
# Frontend
npm run lint && npm run typecheck && npm run test && npm run build
# Salud
curl http://localhost:3000/api/v1/health
```

> Aún no ejecutado; se ejecutará al crear el proyecto.

---

## 4. Fase 1 — Modelo de datos y migración inicial

### Objetivo

Materializar el ERD aprobado en Prisma/MySQL, con restricciones, índices y datos de desarrollo reproducibles.

### Dependencias

- Fase 0.
- D-01 (single/multi-tenant), D-02 (ubicaciones, aprobada), D-14 (dispositivos y captura offline, aprobada), D-15 (zona horaria), D-22 (índices por volumen), D-25 (sin tablas de lote), D-26 (enum de condición, aprobada), D-29 (costos opcionales), D-31 (taller interno).

### Alcance

- `schema.prisma` con todas las entidades del MVP: usuarios, roles, permisos, refresh tokens, idempotencia, dispositivos, ubicaciones, tipos, proveedores, extintores, movimientos, órdenes, servicios, inspecciones, fechas objetivo, umbrales, auditoría, contadores.
- Cambios aprobados a incluir: `LocationType` del MVP reducido a `SEDE`, `ALMACEN`, `AREA` y `TALLER`; dos niveles con nombre único por sede (D-02); `movements.entry_source`, `maintenance_orders.provider_id` nullable + `workshop_location_id` con `CHECK` de exclusividad (D-31); `maintenance_services.cost`/`currency` opcionales con `CHECK` de coherencia (D-29); `devices` y campos `client_uuid`, `capture_mode`, `device_id`, `synced_at` (D-14); sin tablas de lote (D-25).
- Enums y relaciones.
- Migración inicial.
- SQL manual para `CHECK`, columna generada `active_key` y índices especiales.
- Seed de desarrollo: usuarios ficticios, ubicaciones, tipos, proveedores, extintores de ejemplo; sin umbrales ni fechas inventadas.
- Documento `docs/modelo-entidad-relacion.md` actualizado si la migración revela ajustes.

### Archivos esperados

```text
backend/prisma/schema.prisma
backend/prisma/migrations/0001_init/migration.sql
backend/prisma/seed.ts
backend/src/prisma/prisma.module.ts
backend/src/prisma/prisma.service.ts
backend/test/jest-integration.json
backend/test/integration/global-setup.ts
backend/test/integration/constraints.integration-spec.ts
docs/modelo-entidad-relacion.md
```

### Criterios de aceptación

- `prisma validate` sin errores.
- `prisma migrate deploy` desde base vacía crea todas las tablas, enums, FKs e índices.
- Restricciones C-01 a C-19 verificadas con pruebas de integración.
- Seed ejecutable dos veces sin duplicar (idempotente) o con reset controlado.
- ERD y migración coinciden.
- No se siembran periodos ni fechas técnicas inventadas.

### Pruebas

- T-MIG-01, T-MIG-02, T-MIG-03, T-MIG-04, T-MIG-07.
- Integración: duplicado de `asset_code`, placement inconsistente, orden activa duplicada, `days_before` negativo.
- Verificación de que `movements`, `inspections`, `maintenance_services` y `audit_logs` no tienen `updated_at` ni endpoints de borrado.

### Riesgos

| Riesgo | Mitigación |
|---|---|
| `CHECK`/columna generada no soportada por Prisma | SQL manual en migración; prueba desde cero. |
| FKs circulares movimientos/órdenes | Orden de inserción documentado; transacción; pruebas. |
| Enums rígidos | `TechnicalCondition` es fijo (D-26); documentar migración y pruebas si se agrega un valor. |
| Zona horaria | Guardar UTC; pruebas de borde. |

### Verificación

```bash
npx prisma validate
npx prisma migrate deploy
npx prisma db seed
npm run test:integration -- --runInBand
```

### Estado de ejecución (2026-11-16)

Implementado:

- `backend/prisma/schema.prisma`: 20 modelos, 16 enums, `@@map`/`@map`, índices y `onDelete: Restrict`.
- `backend/prisma/migrations/0001_init/migration.sql`: DDL generado por Prisma + SQL manual para 14 `CHECK`, columna generada `active_key` y su índice único.
- `backend/prisma/seed.ts`: semilla idempotente (26 permisos, 4 roles y su matriz, administrador, 4 ubicaciones, 2 tipos, 1 proveedor, 3 extintores con movimiento de ingreso, 5 umbrales con `days_before = NULL`, 2 contadores).
- `backend/src/prisma/prisma.module.ts` y `prisma.service.ts`, registrados en `app.module.ts`.
- `backend/test/jest-integration.json`, `test/integration/global-setup.ts` y `constraints.integration-spec.ts`.

Resultados reales de la verificación:

| Comando | Resultado |
|---|---|
| `npx prisma validate` | Esquema válido. |
| `npx prisma migrate deploy` sobre `site` vacía | 21 tablas (20 modelos + `_prisma_migrations`), 14 `CHECK`, 44 FK, `active_key` `STORED GENERATED`. |
| `npx prisma db seed` dos veces | Mismos conteos: 1 usuario, 4 roles, 26 permisos, 65 role_permissions, 4 ubicaciones, 3 extintores, 3 movimientos, 5 umbrales con `days_before` nulo y 0 filas en `due_dates`. |
| `npm run test:integration` | 33 pruebas, 33 correctas (C-01..C-15, C-17, C-18, C-19). |
| `npm run lint` | Sin errores. |
| `npm run typecheck` | Sin errores. |
| `npm test` | 6 pruebas, 6 correctas. |
| `npm run test:e2e` | 2 pruebas, 2 correctas. |
| `npm run build` | Compila. |

Desviaciones y notas:

- No se creó `backend/prisma/seed-data/`: una sola semilla `prisma/seed.ts` cubre el alcance.
- Se añadió `bcryptjs` (coste 12) para que el administrador sembrado tenga un hash real, conforme a D-06b. La contraseña se toma de `SEED_ADMIN_PASSWORD` o se genera y muestra una sola vez.
- C-16 y la validación de nombres de sede de C-17 son reglas de servicio: se prueban en la fase que implemente esos servicios. El `UNIQUE(parent_id, name)` de las hijas sí queda cubierto.
- C-02 usa `REGEXP_LIKE(..., 'c')` porque la colación *case-insensitive* aceptaría códigos en minúsculas (ver `modelo-entidad-relacion.md` §9.1).
- `active_key` no se declara en `schema.prisma`; la diferencia que reporta `prisma migrate diff` es esperada y no debe aplicarse.

---

## 5. Fase 2 — Autenticación, RBAC y auditoría base

### Objetivo

Permitir acceso seguro y sentar la base de autorización y trazabilidad que usarán todos los módulos.

### Dependencias

- Fase 1.
- D-06 (auth, aprobada: local con `AuthProvider` desacoplado), D-06b (política de contraseñas, aprobada: 12–128, sin caducidad ni MFA), D-07 (roles, aprobada), D-27 (condición, aprobada: `SEGURIDAD` y `ADMIN`).

### Alcance

- Login, refresh rotativo, logout, `/me`, cambio de contraseña.
- Interfaz `AuthProvider` con implementación `LOCAL`; sin endpoints de SSO en el MVP.
- Validador de contraseñas: 12–128 caracteres, sin composición obligatoria, rechazo de contraseñas comunes.
- Hash Argon2id o bcrypt costo ≥12.
- Usuarios, roles, permisos y asignación.
- Guards de autenticación y permisos.
- Rate limit de login/refresh.
- Auditoría base (acción, actor, entidad, antes/después, request ID).
- Usuario administrador inicial por script seguro, no por contraseña hardcodeada.

### Archivos esperados

```text
backend/src/modules/auth/
backend/src/modules/users/
backend/src/common/guards/
backend/src/common/decorators/
backend/src/common/interceptors/
backend/src/modules/audit/
backend/test/auth.e2e-spec.ts
backend/test/rbac.e2e-spec.ts
```

### Criterios de aceptación

- Login válido devuelve access token y cookie refresh.
- Refresh rota y revoca el anterior; reutilización revoca la familia.
- Logout revoca.
- Usuario inactivo no accede.
- 401 sin token; 403 sin permiso.
- Contraseña nunca en texto plano ni en logs/auditoría.
- Rate limit de login funciona.
- Auditoría de login, cambios de usuario/rol y permisos.
- La sesión y los permisos no dependen del proveedor de identidad; sustituirlo por un doble en pruebas no cambia el resultado.
- La política de contraseñas de D-06b se aplica en el backend, no solo en el formulario.

### Pruebas

- T-AUT-01 a T-AUT-18.
- T-SEC-01, T-SEC-02, T-SEC-06, T-SEC-07, T-SEC-11, T-SEC-12, T-SEC-13.
- Unitarias de permisos y hash.

### Riesgos

| Riesgo | Mitigación |
|---|---|
| Refresh token mal almacenado | Cookie `HttpOnly`/`Secure`/`SameSite`; hash en DB; rotación. |
| Bucles de refresh en frontend | Fase 8: refresh single-flight y logout ante 401. |
| Permisos inconsistentes | Matriz aprobada; pruebas 403 por endpoint. |
| Bloqueo de cuentas | Rate limit temporal, no bloqueo permanente por defecto. |

### Verificación

```bash
npm run test -- auth
npm run test:e2e -- auth
npm run lint && npm run typecheck && npm run build
```

### Estado de ejecución (2026-11-16)

Implementado:

- `backend/src/modules/auth/`: `AuthProvider` + `LocalAuthProvider`, login, refresh rotativo, logout, `/me`, cambio de contraseña, política de contraseñas, rate limit y emisión de tokens.
- `backend/src/modules/users/`: CRUD de usuarios (sin borrado físico), roles, catálogo de permisos y reemplazo de la matriz de permisos.
- `backend/src/modules/audit/`: registro append-only y consulta paginada en `GET /audit-logs`.
- `backend/src/common/`: guards (`JwtAuthGuard`, `PasswordChangeGuard`, `PermissionsGuard`), decoradores, contrato de error, `requestId` y filtro global.
- `backend/src/app.module.ts` y `backend/src/main.ts`: `JwtModule` global, guards globales, filtro global, middleware de `requestId`, `cookie-parser`, CORS con credenciales y `ValidationPipe` con 422.
- `backend/test/auth.e2e-spec.ts`, `rbac.e2e-spec.ts`, `e2e-fixtures.ts`, `e2e-app.ts`, `e2e-env.ts`, `jest-e2e.json` y `src/modules/auth/password-policy.spec.ts`.

Resultados reales de la verificación:

| Comando | Resultado |
|---|---|
| `npm run lint` | Sin errores. |
| `npm run typecheck` | Sin errores. |
| `npm test` | 16 pruebas, 16 correctas (entorno + política de contraseñas). |
| `npm run test:e2e` | 26 pruebas, 26 correctas (auth, RBAC y auditoría). |
| `npm run test:integration` | 33 pruebas, 33 correctas (sin regresiones). |
| `npm run build` | Compila. |

Cobertura de pruebas:

- T-AUT-01, 02, 03, 04, 05, 06, 08, 09, 10, 11, 12, 13, 17 y 18.
- T-AUT-15 y T-AUT-16 como pruebas unitarias de la política de contraseñas.
- T-SEC-01, 02, 06, 07, 09, 11, 12 y 13.
- Validación de DTO con 422 y formato `{ error: { code, message, details?, requestId } }`.

Desviaciones y notas:

- **Refresh token opaco, no JWT.** Se guarda solo su hash SHA-256 en `refresh_tokens`; la rotación revoca el anterior y la reutilización revoca la familia completa.
- **Access token ligado a la sesión.** El JWT incluye `sub` y `sid` (familia de refresh). En cada solicitud se recargan usuario, estado y permisos desde la base; un usuario desactivado o una sesión revocada pierden acceso de inmediato.
- **Rate limit de login en memoria.** Es un contador por IP y por correo con ventana deslizante. El MVP corre en una sola instancia; con varias instancias debe moverse a un almacén compartido. El login exitoso limpia solo el contador del correo, no el de la IP.
- **Auditoría de fallo best-effort.** Si no se puede escribir el registro de un login fallido, la respuesta sigue siendo 401 y el problema se registra en el log del servidor.
- **Origen en refresh/logout.** Además de `SameSite=Strict`, se valida la cabecera `Origin` contra `CORS_ORIGINS` cuando el navegador la envía.
- **T-AUT-07 y T-AUT-14 se difieren.** Requieren endpoints de movimientos y de cambio de condición, que pertenecen a fases posteriores. En esta fase se cubre el equivalente 403 sobre `/users` y `/roles/:id/permissions`, verificando que no hay efectos en la base.
- **T-SEC-08 no se prueba con supertest.** CORS lo aplica el navegador; la configuración se valida en `main.ts` con `CORS_ORIGINS` y credenciales.
- **Base de pruebas dedicada.** Los e2e usan `site_test` mediante `test/integration/global-setup.ts` y `test/e2e-env.ts`; nunca tocan la base de desarrollo.
- **Sin recuperación de contraseña por correo ni MFA.** D-06b lo excluye del MVP; el reset lo hace un administrador y obliga el cambio en el siguiente inicio de sesión.

---

## 6. Fase 3 — Ubicaciones y catálogos

### Objetivo

Permitir configurar la estructura física y los catálogos que usan los activos y movimientos.

### Dependencias

- Fase 2.
- D-02 (estructura real, aprobada).

### Alcance

- CRUD de ubicaciones con jerarquía de dos niveles, tipos, activación y validación de profundidad y del tipo del padre.
- CRUD de tipos de extintor.
- CRUD de contrapartes externas.
- Listados paginados/filtrados.
- Auditoría de cambios.
- Permisos `locations.*`, `catalogs.*`.

### Archivos esperados

```text
backend/src/modules/locations/
backend/src/modules/catalogs/extinguisher-types/
backend/src/modules/catalogs/external-parties/
backend/test/locations.e2e-spec.ts
backend/test/catalogs.e2e-spec.ts
```

### Criterios de aceptación

- Se crea la jerarquía de prueba completa.
- Código duplicado → 409.
- Ciclo → 422.
- Ubicación con activos no se desactiva de forma que rompa la integridad.
- Ubicación/proveedor inactivo no se usa en movimientos nuevos.
- Listados paginados y filtrados en servidor.

### Pruebas

- T-UBI-01 a T-UBI-07.
- Unitarias de detección de ciclos.
- Integración de desactivación y referencias.

### Riesgos

| Riesgo | Mitigación |
|---|---|
| Jerarquía real distinta a la supuesta | D-02 antes de la fase; datos configurables. |
| Borrado accidental | Desactivación lógica; FK `RESTRICT`. |
| Ubicación “almacén” con nombre engañoso | Validar por `type`, no por nombre. |

### Verificación

```bash
npm run test -- locations catalogs
npm run test:e2e -- locations
npm run lint && npm run typecheck && npm run build
```

### Estado de ejecución (2026-11-16)

Implementado:

- `backend/src/modules/locations/`: CRUD de ubicaciones, jerarquía de dos niveles, árbol, validación de padre activo, bloqueo de ciclos, generación de código y desactivación con validación de dependencias.
- `backend/src/modules/catalogs/extinguisher-types/`: CRUD de tipos, validación de vida útil y recálculo transaccional de fechas `EQUIPO`.
- `backend/src/modules/catalogs/external-parties/`: CRUD de contrapartes externas con desactivación lógica.
- `backend/src/common/codes/code-counter.service.ts`: contador `UBI-` con `SELECT ... FOR UPDATE` dentro de la transacción.
- `backend/src/common/errors/error-codes.ts`: `LOCATION_CYCLE`, `LOCATION_DEPTH`, `LOCATION_PARENT_TYPE`, `LOCATION_NAME_DUPLICATE` y `USEFUL_LIFE_INVALID`.
- `backend/src/app.module.ts`: módulos de ubicaciones y catálogos conectados.
- `backend/test/locations.e2e-spec.ts`, `backend/test/catalogs.e2e-spec.ts`, `backend/src/common/codes/code-counter.service.spec.ts` y `backend/src/modules/catalogs/extinguisher-types/equipment-due-dates.service.spec.ts`.

Resultados reales de la verificación:

| Comando | Resultado |
|---|---|
| `npm run lint` | Sin errores. |
| `npm run typecheck` | Sin errores. |
| `npm test` | 25 pruebas, 25 correctas (16 previas + 3 del contador + 6 de fechas). |
| `npm run test:e2e` | 53 pruebas, 53 correctas (26 previas + 17 de ubicaciones + 10 de catálogos). |
| `npm run test:integration` | 33 pruebas, 33 correctas (sin regresiones). |
| `npm run build` | Compila. |
| `npm run prisma:validate` | Esquema válido. |

Cobertura de pruebas:

- T-UBI-01, 02, 03, 04, 06, 08, 09, 10, 11 y 12.
- Reglas adicionales: desactivación de taller con orden abierta, cambio de padre sin historial, rechazo de padre inactivo o inexistente, paginación, árbol, inventario por sede, 404 y 403.
- Recalculo de `EQUIPO` con fecha calculada, fecha documentada más temprana y limpieza al quitar la vida útil.
- Pruebas unitarias del formato de código y de la suma de años con ajuste de 29 de febrero.

Desviaciones y notas:

- **T-UBI-05, T-UBI-07 y T-UBI-13 se difieren.** Requieren movimientos o asignación de extintores, que pertenecen a la fase 4.
- **Código enviado por el cliente.** Gracias a `forbidNonWhitelisted`, cualquier intento de enviar `code` en el alta o la edición responde `422 VALIDATION_ERROR`; el código solo lo genera el servidor.
- **Desactivación.** Responde `409 CONFLICT` si hay extintores actuales, hijos activos u órdenes de mantenimiento abiertas en un taller. Es idempotente: una ubicación ya inactiva responde `204`.
- **Jerarquía.** La API solo permite dos niveles; `LOCATION_CYCLE` queda como defensa para datos antiguos o cambios futuros y no es alcanzable con el contrato actual.
- **Vida útil.** El DTO valida que sea entero; el servicio valida el rango 1–65535 y devuelve `USEFUL_LIFE_INVALID`. Un valor no entero responde `VALIDATION_ERROR`.
- **Fechas `EQUIPO`.** Se recalculan en la misma transacción del cambio de tipo. Si el 29 de febrero cae en un año no bisiesto, se usa el 28 de febrero para no desplazar el vencimiento al mes siguiente.
- **Sin borrado físico.** No hay `DELETE` de ubicaciones, tipos ni contrapartes; se desactivan con `active = false` y las referencias históricas se conservan.
- **Contador sin reintento ante creación concurrente.** La semilla crea los contadores; si faltara la fila, la primera transacción la crea. El bloqueo `FOR UPDATE` evita códigos duplicados en el uso normal.

---

## 7. Fase 4 — Extintores, código, QR y alta inicial

### Objetivo

Entregar el primer flujo vertical completo: crear un activo individual, generar su código y QR, registrar su ingreso y consultarlo.

### Dependencias

- Fase 3.
- D-03 (ubicación inicial), D-04 (código), D-05 (QR), D-12 (vencimiento del equipo), D-16 (serie), D-26b (efecto de la condición).

### Alcance

- Servicio de contador de códigos con bloqueo.
- Alta transaccional: ficha + `INGRESO` + `due_dates` + auditoría.
- Rechazo de alta en área con condición `NO_OPERATIVO` (D-26b).
- Registro de idempotencia para el alta (`POST /extinguishers`), reutilizable por los flujos posteriores.
- Ficha, listado, búsqueda y filtros.
- Edición de campos descriptivos/técnicos con `rowVersion`; rechazo de ubicación/estado.
- Actualización de `due_dates` al editar la fecha documentada del equipo o la vida útil de su tipo (D-12).
- Cambio de condición técnica auditado.
- Generación de QR (PNG/SVG) y etiqueta HTML.
- Resolución por código.
- Importación controlada (si D-24 lo requiere) o script separado.

### Archivos esperados

```text
backend/src/modules/extinguishers/
backend/src/modules/extinguishers/dto/
backend/src/modules/extinguishers/qr.service.ts
backend/src/modules/extinguishers/code-counter.service.ts
backend/src/modules/movements/ (movimiento inicial)
backend/test/extinguishers.e2e-spec.ts
backend/test/qr.e2e-spec.ts
```

### Criterios de aceptación

- Alta en almacén → `EN_ALMACEN`; alta en área → `ASIGNADO` (según D-03).
- Código `EXT-000001` generado, único y no editable.
- Dos altas concurrentes no colisionan.
- Un reintento con la misma `Idempotency-Key` devuelve la misma ficha y no duplica el `INGRESO`; con payload distinto devuelve 409.
- `INGRESO` con secuencia 1 y snapshots.
- QR con solo el código/URL aprobada; sin PII.
- Etiqueta legible con código textual.
- PATCH con ubicación/estado → 422.
- Edición y condición auditadas.
- Búsqueda por código/QR funciona; inexistente → 404.

### Pruebas

- T-EXT-01 a T-EXT-12.
- T-QR-01 a T-QR-05, T-QR-09.
- T-CON-03.
- T-MOV-16/17 para el alta (rollback).

### Riesgos

| Riesgo | Mitigación |
|---|---|
| Colisión de códigos | Contador con `FOR UPDATE`; unique; prueba concurrente. |
| QR con datos cambiantes | Servicio de QR con payload fijo; prueba de contenido. |
| Impresión ilegible | Prueba de tamaño/contraste; código textual. |
| Importación con datos sucios | Dry-run, reporte, validación y corrección manual. |

### Verificación

```bash
npm run test -- extinguishers qr
npm run test:e2e -- extinguishers
npm run lint && npm run typecheck && npm run build
```

### Estado de ejecución (2026-11-16)

Implementado en la fase 4A:

- `backend/src/modules/extinguishers/`: alta transaccional, listado, ficha, resolución por código, edición con `rowVersion`, cambio de condición, QR y etiqueta.
- `backend/src/common/codes/code-counter.service.ts`: contador `EXT-` (`EXTINGUISHER`) y módulo global `CodeCounterModule`.
- `backend/src/common/rate-limit/sliding-window-rate-limiter.ts`: ventana deslizante reutilizable; `QrRateLimiter` aplica límites por usuario y por IP.
- `backend/src/modules/catalogs/extinguisher-types/equipment-due-dates.service.ts`: fecha `EQUIPO` reutilizada por el alta y por el `PATCH`.
- `backend/src/config/env.ts` y `.env.example`: `RATE_LIMIT_QR_USER`, `RATE_LIMIT_QR_IP`, `RATE_LIMIT_QR_WINDOW_SECONDS`.
- `backend/src/common/errors/error-codes.ts`: `ASSET_NOT_FOUND`, `ASSET_RETIRED`, `ASSET_CODE_DUPLICATE`, `DESTINATION_INVALID`, `CONDITION_NOT_ASSIGNABLE`, `CONCURRENCY_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `DATE_IN_FUTURE`, `DATE_BEFORE_EVENT`.
- `backend/test/extinguishers.e2e-spec.ts`, `backend/test/extinguishers-rollback.e2e-spec.ts`, `backend/src/modules/extinguishers/extinguisher-dates.spec.ts`, `extinguisher-qr.service.spec.ts` y `qr-rate-limiter.spec.ts`.
- `backend/test/e2e-fixtures.ts`: rol y usuario `SEGURIDAD`, permisos de extintores y conteo de usuarios actualizado.

Resultados reales de la verificación:

| Comando | Resultado |
|---|---|
| `npm run lint` | Sin errores. |
| `npm run typecheck` | Sin errores. |
| `npm test` | 40 pruebas, 40 correctas. |
| `npm run test:e2e` | 79 pruebas, 79 correctas (53 previas + 25 de extintores + 1 de rollback). |
| `npm run test:integration` | 33 pruebas, 33 correctas (sin regresiones). |
| `npm run build` | Compila. |
| `npm run prisma:validate` | Esquema válido. |

Cobertura de pruebas:

- T-EXT-01 a T-EXT-08, T-EXT-10, T-EXT-12 a T-EXT-17.
- T-QR-01 a T-QR-05 y T-QR-09.
- T-CON-03 (dos altas simultáneas con códigos distintos).
- T-MOV-16/T-MOV-17: fallo simulado después de insertar el movimiento y la fecha objetivo; rollback completo sin extintor, movimiento, fecha ni registro de idempotencia.
- Reglas adicionales: reintento idempotente, conflicto de payload, clave obligatoria, fechas futuras o anteriores, destinos inválidos, tipo inactivo, ausencia de fecha `EQUIPO` inventada, QR PNG/SVG, etiqueta HTML y permisos por rol.

Desviaciones y notas:

- **Importación D-24 en fase 4B.** El alta ya es estable; la conciliación con dry-run merece su propio diseño y pruebas.
- **Filtros de alertas y línea de tiempo diferidos.** `alertEventType`, `alertStatus` y `GET /extinguishers/:id/timeline` dependen del motor de alertas y de inspecciones/servicios; se implementarán en fases posteriores.
- **T-EXT-18 a T-EXT-21** ya están cubiertas por las pruebas unitarias de fechas `EQUIPO` de la fase 3 y por el alta de esta fase.
- **Idempotencia de 24 h.** La misma clave con el mismo payload devuelve el recurso con `200` e `Idempotent-Replay: true`; con payload distinto responde `409 IDEMPOTENCY_CONFLICT`. Un registro en `PROCESSING` responde `409 CONCURRENCY_CONFLICT`.
- **Concurrencia.** La transacción usa aislamiento `Serializable` y reintenta hasta tres veces conflictos de escritura (`P2034`) o unicidad (`P2002`) antes de devolver un error controlado.
- **Rate limit en memoria.** Es válido para una sola instancia; con varias debe moverse a un almacén compartido.
- **Sin archivos ni PII en el QR.** La etiqueta HTML embebe el PNG y muestra solo el código; no incluye ubicación, fechas ni nombres.

### Estado de ejecución de la fase 4B (2026-11-17)

Implementado en la fase 4B (carga inicial D-24):

- `backend/src/modules/extinguishers/imports/import-file.ts`: parser CSV/JSON con límites (5 MB, 10 000 filas), BOM, delimitador `,`/`;`, comillas escapadas y saltos de línea entre comillas.
- `backend/src/modules/extinguishers/imports/import-validation.ts`: validación por fila, conciliación de tipo/sede/ubicación, reglas de fecha y condición, advertencias de serial duplicado y resumen por sede y ubicación.
- `backend/src/modules/extinguishers/imports/import-token.ts`: comprobante de dry-run firmado con HMAC derivado de `JWT_ACCESS_SECRET`, vigencia de 24 h y huella SHA-256 del archivo y de los campos comunes.
- `backend/src/modules/extinguishers/imports/imports.service.ts` e `imports.controller.ts`: endpoints `POST /extinguishers/imports/dry-run` y `POST /extinguishers/imports` (`multipart/form-data`, permiso `extinguishers.create`).
- `backend/src/modules/extinguishers/imports/dto/imports.dto.ts`: DTO de previsualización y confirmación.
- `backend/src/modules/extinguishers/extinguishers.module.ts`: registro del controlador y servicio de importación.
- `backend/src/common/errors/error-codes.ts`: `IMPORT_FILE_INVALID` e `IMPORT_DRY_RUN_INVALID`.
- `backend/src/common/errors/api-exception.filter.ts`: traducción de errores de Multer (por ejemplo, archivo mayor al límite) a `422 IMPORT_FILE_INVALID`.
- `backend/src/modules/extinguishers/imports/*.spec.ts` y `backend/test/extinguishers-import.e2e-spec.ts`.
- `docs/diseno-api.md`: endpoints, campos, columnas, reglas de CSV/JSON y semántica de la confirmación.

Resultados reales de la verificación:

| Comando | Resultado |
|---|---|
| `npm run lint` | Sin errores. |
| `npm run typecheck` | Sin errores. |
| `npm test` | 67 pruebas, 67 correctas (40 previas + 27 de importación). |
| `npm run test:e2e` | 89 pruebas, 89 correctas (79 previas + 10 de importación). |
| `npm run test:integration` | 33 pruebas, 33 correctas (sin regresiones). |
| `npm run build` | Compila. |
| `npm run prisma:validate` | Esquema válido (sin cambios de esquema en 4B). |
| `./scripts/verify.ps1` | Completa: backend y frontend (lint, typecheck, pruebas, build) sin fallos. |

Cobertura de pruebas:

- T-IMP-01 a T-IMP-13.
- El dry-run no escribe extintores ni consume códigos.
- La confirmación reutiliza el alta transaccional: ficha + `INGRESO` secuencia 1 + fecha `EQUIPO` + auditoría + idempotencia.
- Filas inválidas se omiten sin efectos parciales; los fallos de escritura se reportan por fila como `FAILED`.
- Repetir la confirmación devuelve `REPLAYED` y no duplica activos.
- Seriales duplicados en el archivo o ya registrados generan advertencias, no bloqueos (D-16).
- Comprobante ausente, vencido, alterado, de otro usuario o con archivo distinto responde `409 IMPORT_DRY_RUN_INVALID`.

Desviaciones y notas:

- **Sin tabla ni migración nuevas.** El comprobante es stateless (HMAC) y la protección contra duplicados se apoya en las claves de idempotencia por fila (`imp:<dryRunId>:<fila>`).
- **Carga síncrona.** Para volúmenes grandes se documenta dividir el archivo en lotes operativos; el límite por archivo es de 10 000 filas.
- **Advertencia de serial ya registrado dentro de la misma confirmación.** La detección se calcula antes de escribir; las filas repetidas dentro del mismo archivo se advierten entre sí.
- **Corrección de CI.** La prueba de firma alterada cambiaba el último carácter base64url, cuyos bits de relleno pueden decodificar al mismo HMAC; ahora altera el primer carácter, con bits significativos, y la detección es determinista en Linux y Windows.

---

## 8. Fase 5 — Motor de movimientos

### Objetivo

Implementar el corazón de la trazabilidad: movimientos atómicos, validación de origen, historial inmutable y control de concurrencia.

### Dependencias

- Fase 4.
- D-08 (evidencia, aprobada), D-08b (sin segunda aprobación, aprobada), D-09 (tránsito), D-17 (baja), D-25 (sin lote, aprobada), D-26b (efecto de la condición).

### Alcance

- Servicio único de movimientos con bloqueo de fila, secuencia, snapshots e idempotencia.
- `SALIDA`, `TRASLADO`, `RETORNO_ALMACEN`, `BAJA`, `AJUSTE`.
- Validación de máquina de estados y campos obligatorios.
- Rechazo de destino `AREA` para equipos `NO_OPERATIVO` y de cambio a `NO_OPERATIVO` mientras están asignados (D-26b).
- Historial por activo y global.
- `row_version` y manejo de 409.
- Auditoría transaccional.
- Endpoint de baja y ajuste; ambos se ejecutan directamente con permiso, motivo, `authorizedBy` y `documentRef`, sin flujo de aprobación (D-08b).
- Sin modelo ni endpoint de lote: la selección múltiple de la interfaz se resuelve con una petición por activo y transacciones independientes (D-25).

### Archivos esperados

```text
backend/src/modules/movements/
backend/src/modules/movements/dto/movements.dto.ts
backend/src/modules/movements/movement-policy.ts
backend/src/modules/movements/movement-policy.spec.ts
backend/src/modules/movements/movement-view.ts
backend/src/modules/movements/movements.service.ts
backend/src/modules/movements/movements.controller.ts
backend/src/modules/movements/movements.module.ts
backend/test/movements.e2e-spec.ts
```

### Criterios de aceptación

- Todas las transiciones permitidas funcionan.
- Transiciones prohibidas → 409, sin cambios.
- Origen incorrecto → 409 `ORIGIN_MISMATCH`.
- Baja → `DADO_DE_BAJA`, colocación `NONE`, historial conservado.
- Movimiento posterior a baja → 409.
- Ajuste solo `ADMIN`, con motivo/documento.
- Reintento idempotente no duplica.
- Dos movimientos concurrentes: uno 201, otro 409; secuencia única.
- Fallo simulado → rollback total.
- Historial ordenado, sin edición/borrado.

### Pruebas

- T-MOV-01 a T-MOV-24.
- T-CON-01, T-CON-02, T-CON-05, T-CON-06.
- T-SEC-03, T-SEC-04.

### Riesgos

| Riesgo | Mitigación |
|---|---|
| Deadlocks | Orden de bloqueo consistente; reintento limitado. |
| Actualización de proyección fuera de transacción | Servicio único; revisión de código; pruebas de fallo. |
| Fechas retroactivas | Validación y ajuste administrativo. |
| Doble clic | Idempotencia backend + UI. |

### Verificación

```bash
npm run test -- movement-policy
npm run test:e2e -- movements
npm run lint && npm run typecheck && npm run build
```

### Estado de ejecución de la fase 5 (2026-11-17)

Implementado:

- `backend/src/modules/movements/movement-policy.ts`: matriz de transiciones, validación de origen y destino, evidencia por tipo, reglas de `movedAt` y proyección de estado. Sin dependencias de Prisma ni del request.
- `backend/src/modules/movements/movements.service.ts`: servicio transaccional único con `SELECT ... FOR UPDATE`, secuencia `asset_sequence`, snapshots de origen/destino, `rowVersion`, idempotencia de 24 h y auditoría en la misma transacción.
- `backend/src/modules/movements/movements.controller.ts` y `movements.module.ts`: `POST /extinguishers/:id/movements`, `POST /extinguishers/:id/retire`, `POST /extinguishers/:id/adjustments`, `GET /extinguishers/:id/movements`, `GET /movements` y `GET /movements/:id`.
- `backend/src/modules/movements/movement-view.ts` y `dto/movements.dto.ts`: contrato de respuesta y validación de entrada.
- `backend/src/common/errors/error-codes.ts`: `ORIGIN_MISMATCH`, `INVALID_TRANSITION` y `MAINTENANCE_ORDER_ACTIVE`.
- `backend/test/movements.e2e-spec.ts`: 34 casos e2e (T-MOV-01 a T-MOV-42, incluidas concurrencia, idempotencia, rollback, baja, ajuste y reactivación).
- `backend/test/e2e-fixtures.ts`: permiso `movements.adjust` para la matriz de pruebas.

Supuestos documentados y aprobados para esta fase:

- `SALIDA` solo hacia `AREA`; `TRASLADO` solo almacén↔almacén o área↔área; `RETORNO_ALMACEN` solo hacia `ALMACEN`; `TALLER` se reserva para mantenimiento.
- `authorizedBy` y `documentRef` son opcionales en `SALIDA`, `TRASLADO` y `RETORNO_ALMACEN`; obligatorios en `BAJA` y `AJUSTE`.
- `AJUSTE` no cambia la condición técnica ni el estado de forma independiente: la colocación destino deriva el estado. La reactivación exige `correctsMovementId` del movimiento `BAJA`.
- `movedAt` es obligatorio, con zona horaria, se almacena en UTC y se valida contra el alta, el último movimiento y la tolerancia de 5 minutos.
- Sin migración nueva: el modelo `Movement` y los permisos ya existían.

Verificación ejecutada: `npm run test` 88/88, `npm run test:e2e` 123/123, `npm run test:integration` 33/33, lint, typecheck, build y `prisma validate` correctos; `./scripts/verify.ps1` completo sin errores.

---

## 9. Fase 6 — Mantenimiento, inspecciones y fechas objetivo

### Objetivo

Cubrir el ciclo técnico: envío/retorno de mantenimiento, servicios, inspecciones y actualización de fechas objetivo.

### Dependencias

- Fase 5.
- D-10 (condición, aprobada), D-13 (evidencia textual, aprobada: sin archivos), D-18 (documentos), D-28 (inspección/condición, aprobada: sin cambio automático), D-29 (costos opcionales, aprobada).

### Alcance

- Órdenes de mantenimiento y servicios.
- Envío y retorno transaccionales.
- Una sola orden activa por activo.
- Servicio obligatorio para retorno.
- Servicios internos.
- Inspecciones.
- Idempotencia en servicios e inspecciones.
- Proyección `due_dates` con comparación por fecha de evento.
- Resultado del servicio como evidencia; sin mapeo automático a condición (D-10/D-28).
- Costo y moneda opcionales en el servicio, sin reporte financiero (D-29).
- Endpoints de consulta.

### Archivos esperados

```text
backend/src/modules/maintenance/
backend/src/modules/maintenance/dto/
backend/src/modules/inspections/
backend/src/modules/inspections/dto/
backend/src/modules/due-dates/
backend/test/maintenance.e2e-spec.ts
backend/test/inspections.e2e-spec.ts
backend/test/due-dates.e2e-spec.ts
```

### Criterios de aceptación

- Envío crea orden + movimiento + estado externo.
- Segundo envío → 409.
- Retorno sin servicio → 422.
- Retorno cierra orden, actualiza colocación/estado y fechas.
- Servicio `RECARGA` solo actualiza recarga.
- Servicio sin próxima fecha deja `SIN_FECHA_CONFIGURADA`.
- Servicio retroactivo no pisa la fecha vigente.
- Inspección actualiza su categoría; no cambia condición.
- Condición tras retorno según D-10.
- Historial y auditoría completos.

### Pruebas

- T-MAN-01 a T-MAN-15.
- T-INS-01 a T-INS-07.
- T-ALE-02/03/06 (base de proyección).
- T-CON-02, T-CON-04.

### Riesgos

| Riesgo | Mitigación |
|---|---|
| Proyección desordenada por datos retroactivos | Comparar `source_event_at` + `created_at`; pruebas. |
| Mapeo de condición no aprobado | D-10; si no, no automatizar. |
| Documentos obligatorios | D-18; validación configurable; D-13: referencia textual sin archivos. |
| Órdenes huérfanas | Transacción; pruebas de fallo. |

### Verificación

```bash
npm run test -- maintenance inspections due-dates
npm run test:e2e -- maintenance inspections
npm run lint && npm run typecheck && npm run build
```

### Estado de ejecución (fase 6A, 2026-11-19)

Completado el bloque de mantenimiento y proyección de vencimientos; las inspecciones (6B) quedan pendientes.

- **Infraestructura común:** `common/time/calendar.ts` y `common/time/instant.ts` (instantes ISO 8601 con zona, tolerancia de 5 minutos y fechas de calendario), `common/idempotency/` (hash canónico y registro transaccional reutilizable) y `movements/movement-core.ts` (bloqueo `FOR UPDATE`, snapshot de origen, secuencia y `rowVersion` compartidos con movimientos).
- **Vencimientos:** `due-dates/due-date-projection.ts` reemplaza solo la categoría del evento y solo si la fecha de evento es posterior a la que originó la proyección vigente. `REPARACION` alimenta `MANTENIMIENTO`.
- **Mantenimiento:** `MaintenanceModule` expone `POST /extinguishers/:id/maintenance/send`, `GET /maintenance-orders`, `GET /maintenance-orders/:id`, `POST /maintenance-orders/:id/services`, `POST /extinguishers/:id/services` (servicio interno sin orden) y `POST /maintenance-orders/:id/return`, todos con DTO validado, idempotencia, auditoría y transacción `Serializable`.
- **Supuestos registrados:** la orden nace en `EN_PROVEEDOR` tanto para proveedor externo como para taller interno (`ABIERTA` se reserva para un flujo posterior); el retorno solo admite `ALMACEN`/`AREA` activos; el proveedor del servicio debe coincidir con el de la orden; el servicio sin orden exige `performedByUserId`, prohíbe `providerId` y no cambia colocación ni estado; `performedAt` no puede ser anterior al alta ni a la apertura de la orden; `nextDueDate` debe ser posterior a la fecha local del hecho; costo y moneda son ambos nulos o ambos informados, sin moneda por defecto; servicios e inspecciones no incrementan `rowVersion`; `checklist`, correcciones y cancelación de órdenes quedan diferidos.
- **Incidente corregido:** `parseInstant` confundía la fracción de segundo con los segundos y rechazaba instantes válidos cuando el segundo era `59` con milisegundos (por ejemplo `14:35:59.120Z`). Se corrigió el parseo y se añadió `instant.spec.ts` como regresión. Las pruebas e2e anclan sus fechas al mayor valor entre `movedAt` del alta y `createdAt` para no depender de la latencia de la inserción.
- **Limitación conocida:** un `AJUSTE` de fase 5 hacia `TALLER` o `EXTERNAL_PARTY` deja el extintor en `EN_MANTENIMIENTO` sin orden asociada; solo se corrige con otro `AJUSTE`. Se documentará en la ficha y se evaluará al cerrar la fase 6.
- **Verificación:** `./scripts/verify.ps1` en verde (backend: 122 unitarias, 141 e2e, 33 de integración, lint, typecheck, build y `prisma validate`; frontend: lint, typecheck, 2 pruebas y build).

### Estado de ejecución (fase 6B, 2026-11-19)

Completado el módulo de inspecciones y las extensiones de ficha.

- **Reglas compartidas:** `common/time/event-dates.ts` concentra el parseo de instantes, la fecha local (`calendarDateOf`), la próxima fecha y la validación del hecho; `maintenance-policy.ts` lo reexporta para no duplicar reglas.
- **Inspecciones:** `InspectionsModule` expone `POST /extinguishers/:id/inspections`, `GET /inspections` y `GET /inspections/:id`. La escritura usa DTO validado, `Idempotency-Key`, bloqueo `FOR UPDATE` del extintor, auditoría `INSPECTION_CREATED` y proyección `INSPECCION` en la misma transacción `Serializable`.
- **Checklist:** objeto JSON libre de hasta 20 KB (`inspection-policy.ts`); no se impone un catálogo reglamentario. El resultado es evidencia y no cambia la condición técnica (D-28).
- **Ficha:** `GET /extinguishers/:id` añade `lastInspection` y `openMaintenanceOrder`.
- **Diferido:** correcciones de inspección (`POST /inspections/:id/corrections`, T-INS-07).
- **Verificación:** `./scripts/verify.ps1` en verde (backend: 127 unitarias, 151 e2e, 33 de integración, lint, typecheck, build y `prisma validate`; frontend: lint, typecheck, 2 pruebas y build).

---

## 10. Fase 7 — Alertas, dashboard y reportes

### Objetivo

Convertir las fechas documentadas en información operativa, sin inventar periodos ni duplicar alertas.

### Dependencias

- Fase 6.
- D-11 (umbrales, aprobada: solo fecha indicada y sin umbral inicial), D-12 (vencimiento del equipo, aprobada: documentada + vida útil por tipo), D-19 (formatos, aprobada: JSON + CSV en el MVP), D-20 (notificaciones, aprobada: solo alertas en la aplicación).

### Alcance

- Cálculo de alertas por categoría/estado; para `EQUIPO`, la fecha más temprana entre documentada y calculada (D-12).
- Configuración de umbrales, sin seed ni valores por defecto (D-11).
- Verificación de que las categorías de inspección/servicio no calculan intervalos (D-11).
- Resumen por categoría/estado.
- Dashboard.
- Reportes de inventario, movimientos, mantenimiento, inspecciones y bajas.
- Exportación CSV de cada reporte con `reports.export`; PDF/Excel quedan para fase 2 (D-19).
- Alertas solo en la aplicación: sin SMTP, cola de envío ni canales externos (D-20).
- Filtros y paginación.

### Archivos esperados

```text
backend/src/modules/alerts/
backend/src/modules/dashboard/
backend/src/modules/reports/
backend/src/modules/reports/export/
backend/test/alerts.e2e-spec.ts
backend/test/reports.e2e-spec.ts
```

### Criterios de aceptación

- `VENCIDO`, `POR_VENCER`, `VIGENTE`, `SIN_FECHA_CONFIGURADA` correctos.
- Sin umbral configurado no se inventa “por vencer”.
- Zona horaria correcta en bordes.
- Activos dados de baja excluidos por defecto.
- Repetir consulta no duplica alertas.
- Dashboard y reportes consistentes.
- CSV respeta permisos y columnas mínimas.
- Performance aceptable con volumen de prueba.

### Pruebas

- T-ALE-01 a T-ALE-12.
- T-DASH-01, T-REP-01 a T-REP-03.
- T-PER-01 a T-PER-06.
- T-SEC-14.

### Riesgos

| Riesgo | Mitigación |
|---|---|
| Umbrales no aprobados | No sembrar valores; configuración explícita. |
| Consultas costosas | Índices `due_dates`; paginación; `EXPLAIN`. |
| Reportes con datos de más | Autorización y columnas mínimas. |
| Fechas ambiguas | `DATE` para calendario; UTC para eventos. |

### Verificación

```bash
npm run test -- alerts dashboard reports
npm run test:e2e -- alerts reports
npm run test:perf
npm run lint && npm run typecheck && npm run build
```

### Implementación 7A (alertas y umbrales)

- **Reglas puras:** `alert-policy.ts` clasifica cada fecha con `VENCIDO` (`daysRemaining < 0`), `POR_VENCER` (solo con umbral configurado), `VIGENTE` y `SIN_FECHA_CONFIGURADA`; `EQUIPO` lee la proyección `due_dates`, que ya resuelve la fecha documentada/calculada más temprana.
- **API:** `AlertsModule` expone `GET /alerts`, `GET /alerts/summary`, `GET /alert-settings` (`alerts.read`) y `PUT /alert-settings/:eventType` (`alerts.settings`). Los umbrales sin fila se devuelven habilitados y con `daysBefore = null`; nunca se siembran valores.
- **Cálculo y volumen:** las filas se ensamblan en memoria sobre el volumen D-22 (10k activos × 5 categorías) y se ordenan/paginan en el servidor; no se persisten alertas.
- **Bajas y categorías deshabilitadas:** las bajas se excluyen por defecto (`includeRetired=true` las incluye) y una categoría deshabilitada desaparece de listado y resumen.
- **Auditoría:** cada cambio de umbral registra `ALERT_SETTING_UPDATED` con el estado anterior y posterior en la misma transacción.
- **Verificación:** 137 unitarias y 13 e2e nuevas de alertas en verde; lint, typecheck y build sin errores.

### Implementación 7B (dashboard)

- **API:** `DashboardModule` expone `GET /dashboard/summary` con permiso `dashboard.read`.
- **Activos:** `operationalTotal` excluye `DADO_DE_BAJA`; las bajas se informan en `retiredTotal` y `byLogisticsStatus.DADO_DE_BAJA`. Se incluyen conteos por condición técnica, colocación y ubicación (`byLocation`) más `withoutLocation`.
- **Mantenimiento:** `openOrders` suma `ABIERTA` y `EN_PROVEEDOR`; `overdueReturns` cuenta órdenes abiertas con retorno previsto anterior al día calendario en `America/Lima`.
- **Alertas:** el bloque `alerts` reutiliza `/alerts/summary`, de modo que respeta umbrales, categorías deshabilitadas y la exclusión de bajas.
- **Pruebas:** T-DASH-01 valida los conteos contra datos reales y T-DASH-02 cubre autenticación y permiso.

### Implementación 7C (reportes y CSV)

- **API:** `ReportsModule` expone `GET /reports/inventory`, `/reports/movements`, `/reports/maintenance`, `/reports/inspections`, `/reports/retired` (`reports.read`) y `GET /reports/:type/export` (`reports.export`).
- **Reutilización:** inventario, movimientos e inspecciones usan los servicios y filtros ya probados de sus módulos; mantenimiento devuelve órdenes con `services` y costo por servicio, sin totales financieros (D-29); bajas devuelve `BAJA` y `AJUSTE` con su motivo.
- **CSV:** UTF-8 con BOM, coma, CRLF, comillas y protección contra inyección de fórmulas; mismos filtros que el JSON, sin archivos persistentes y con límite de 100 000 filas.
- **Formatos:** solo CSV; `format` distinto de `csv`, tipos desconocidos y rutas PDF/Excel responden `404` (D-19).
- **Pruebas:** T-REP-01 a T-REP-08 cubren inventario, movimientos, ambos permisos de CSV, formatos no soportados, mantenimiento con costos, inspecciones y bajas/ajustes.

---

## 11. Fase 8 — Frontend: base, login y shell

### Objetivo

Crear la aplicación Angular real, segura y accesible, conectada a la API de autenticación.

### Dependencias

- Fase 2 y API estable de auth.
- Fase 7 para el dashboard inicial (puede desarrollarse en paralelo con contrato).

### Alcance

- Angular standalone, rutas lazy, layout responsive.
- Login, refresh, logout, cambio de contraseña.
- `AuthService` con token en memoria y refresh single-flight.
- Interceptores de auth/error/request ID.
- Guards de autenticación y permisos.
- Directiva `hasPermission`.
- Componentes compartidos: tabla, paginación, chips de estado, confirmación, vacío, errores.
- Accesibilidad base.
- Localización base: un solo idioma `es-PE`, textos en claves de traducción y pipes de fecha/número/moneda (D-30).
- Entorno de API por configuración.

### Archivos esperados

```text
frontend/src/app/core/auth/
frontend/src/app/core/api/
frontend/src/app/core/permissions/
frontend/src/app/shared/components/
frontend/src/app/shared/i18n/
frontend/src/app/layout/
frontend/src/app/features/auth/
frontend/src/app/app.routes.ts
frontend/src/app/app.config.ts
frontend/e2e/auth.spec.ts
```

### Criterios de aceptación

- Login/logout/refresh funcionan contra API real.
- 401 redirige a login sin bucles.
- 403 muestra mensaje y no rompe la app.
- Menú y acciones se ocultan según permiso (sin reemplazar backend).
- Layout usable en 360 px.
- Navegación por teclado y foco visible.
- Sin token en `localStorage`.

### Pruebas

- Unitarias de AuthService/guards.
- E2E de login, logout, refresh, 403.
- Accesibilidad base con axe.

### Riesgos

| Riesgo | Mitigación |
|---|---|
| Refresh loop | Single-flight; logout ante fallo; pruebas. |
| CORS/cookies | Configuración por entorno; HTTPS en producción. |
| Permisos solo en UI | Guards + pruebas de API 403. |
| Diseño no responsive | Pruebas a 360/768/1280. |

### Verificación

```bash
npm run lint && npm run typecheck && npm run test && npm run build
npm run e2e -- auth
```

---

## 12. Fase 9 — Frontend: inventario, QR y etiquetas

### Objetivo

Permitir operar el inventario desde la interfaz: listar, buscar, crear, consultar, escanear e imprimir.

### Dependencias

- Fase 8 + Fase 4.
- D-05 (QR) confirmado.

### Alcance

- Lista de extintores con filtros y paginación.
- Ficha con ubicación, estado, condición, alertas e historial.
- Formulario de alta y edición.
- Cambio de condición.
- Escáner QR: cámara, USB 2D, manual.
- Servicio de escaneo desacoplado.
- Etiqueta imprimible.
- Manejo de cámara denegada/no disponible.
- Búsqueda por código.

### Archivos esperados

```text
frontend/src/app/features/extinguishers/
frontend/src/app/features/scan/
frontend/src/app/core/qr/
frontend/src/app/features/extinguishers/label/
frontend/e2e/extinguishers.spec.ts
frontend/e2e/scan.spec.ts
```

### Criterios de aceptación

- Alta desde UI contra API real; código/QR visibles.
- Ficha muestra datos correctos y no permite editar ubicación/estado.
- Escaneo con cámara (si hay permiso) y fallback manual/USB.
- Código inexistente informa sin crear.
- Etiqueta sin PII, legible, imprimible.
- Búsqueda/filtros funcionan con servidor.
- Accesibilidad de formularios.

### Pruebas

- T-QR-01 a T-QR-10 (E2E con mocks de cámara cuando haga falta).
- T-EXT-01 a T-EXT-12 (UI/API).
- Prueba manual con hardware real (cámara y lector USB) documentada.

### Riesgos

| Riesgo | Mitigación |
|---|---|
| Permisos de cámara/HTTPS | HTTPS/localhost; mensajes claros; fallback. |
| Lector USB no enfoca campo | Autofocus, campo dedicado, debounce. |
| Etiqueta ilegible | Prueba de impresión; tamaño/contraste. |
| UI lenta con muchos datos | Paginación servidor; no cargar todo. |

### Verificación

```bash
npm run lint && npm run typecheck && npm run test && npm run build
npm run e2e -- extinguishers scan
```

---

## 13. Fase 10 — Frontend: operaciones y administración

### Objetivo

Completar los flujos operativos y de administración del MVP.

### Dependencias

- Fase 9 + Fases 5–7.

### Alcance

- Wizard de movimientos: salida, traslado, retorno, baja, ajuste.
- Selección múltiple de activos para movimientos y resultado por equipo, con una petición por activo (D-25).
- Envío/retorno de mantenimiento y servicios.
- Inspecciones.
- Alertas y configuración de umbrales.
- Dashboard.
- Reportes y exportación CSV.
- Administración de usuarios, roles, ubicaciones, catálogos y auditoría.
- Confirmaciones, estados de carga, errores y prevención de doble envío.

### Archivos esperados

```text
frontend/src/app/features/movements/
frontend/src/app/features/maintenance/
frontend/src/app/features/inspections/
frontend/src/app/features/alerts/
frontend/src/app/features/dashboard/
frontend/src/app/features/reports/
frontend/src/app/features/admin/
frontend/e2e/movements.spec.ts
frontend/e2e/maintenance.spec.ts
frontend/e2e/alerts.spec.ts
```

### Criterios de aceptación

- Todos los flujos del MVP funcionan desde UI contra API real.
- Acciones no permitidas no se muestran y el backend las rechaza.
- No hay botones sin implementación.
- Doble clic no duplica movimientos.
- Formularios móviles usables.
- Errores claros y sin datos internos.
- Dashboard y reportes coinciden con la API.

### Pruebas

- E2E-01, E2E-02, E2E-03.
- T-MOV, T-MAN, T-INS, T-ALE en UI.
- Accesibilidad de formularios críticos.

### Riesgos

| Riesgo | Mitigación |
|---|---|
| Formularios complejos | Wizard por pasos; validación; pruebas. |
| Permisos inconsistentes | Guards + pruebas 403; matriz aprobada. |
| Doble envío | Idempotencia + botón deshabilitado. |
| Alcance creciente | Congelar MVP; backlog fase 2. |

### Verificación

```bash
npm run lint && npm run typecheck && npm run test && npm run build
npm run e2e
```

---

## 14. Fase 11 — Operación sin conexión (PWA)

### Objetivo

Permitir consultar y preparar movimientos e inspecciones sin red, sin comprometer la regla de validar el origen contra el estado vigente en el servidor.

### Dependencias

- Fase 10.
- D-14 (offline aprobado: PWA con lectura en caché y borradores confirmados al sincronizar; ventana de 7 días).

### Alcance

- Service worker y caché del shell y de los datos del alcance asignado.
- IndexedDB cifrada, limitada al usuario y a sus sedes/áreas.
- Registro de dispositivos y permiso `devices.manage`.
- Cola de borradores con `clientUuid` y estados pendiente/conflicto.
- Endpoints `/sync/scope`, `/sync/drafts` y `/sync/status`.
- Confirmación en servidor con validación de origen, permisos y reglas; rechazo completo sin cambios parciales.
- Bloqueo de `BAJA`, `AJUSTE`, cambio de condición y administración sin conexión.
- Ventana máxima de 7 días sin sincronizar, aplicada en cliente y servidor.
- UI de sincronización: pendientes, conflictos y última sincronización.
- Pruebas T-OFF-01..12.

### Archivos esperados

```text
backend/src/sync/
frontend/src/app/offline/
frontend/src/app/core/offline/
frontend/ngsw-config.json
prisma/migrations/*_devices_and_capture_fields/
docs/offline.md
```

### Criterios de aceptación

- Un borrador nunca altera ubicación, estado, condición ni fechas antes de confirmarse.
- Un conflicto de origen se rechaza completo y se muestra para corrección.
- El reenvío del mismo `clientUuid` no duplica el registro.
- Las operaciones sensibles se bloquean sin conexión en UI y API.
- La ventana de 7 días se aplica en cliente y servidor.
- Los datos locales están cifrados y se eliminan al cerrar sesión con advertencia si hay pendientes.
- T-OFF-01..12 ejecutadas y reportadas.

### Pruebas

- T-OFF-01..12.
- T-MOV-01..03 y T-INS-01..06 repetidas en modo offline.
- T-SEC-02/03 para permisos al sincronizar.

### Riesgos

| Riesgo | Mitigación |
|---|---|
| Conflictos de origen frecuentes | Mostrar la ubicación vigente y permitir corregir; no aplicar cambios parciales. |
| Pérdida de borradores | Cifrado local, aviso al cerrar sesión y sincronización temprana. |
| Usuario revocado que sigue operando | Ventana de 7 días y revalidación de permisos en cada sincronización. |
| Complejidad de la cola | Librería simple, pruebas de idempotencia y límites de alcance claros. |

### Verificación

```bash
npm run test
npm run e2e -- --grep offline
npm run lint
npm run typecheck
npm run build
```

---

## 15. Fase 12 — E2E, seguridad, rendimiento y despliegue

### Objetivo

Pasar de “funciona en desarrollo” a “operable con seguridad y respaldo”.

### Dependencias

- Fase 11.
- D-21 (retención, aprobada: conservación indefinida en el MVP), D-22 (volumen, aprobado: 10 000 activos y 100 000 movimientos), D-23 (despliegue y respaldo, aprobado: híbrido con RPO 24 h / RTO 4 h).

### Alcance

- Suite E2E completa y estable.
- Pruebas de seguridad y autorización.
- Pruebas de rendimiento con volumen sintético.
- Revisión de accesibilidad.
- Migración desde cero y desde versión anterior.
- Backup/restauración probada.
- Despliegue híbrido: app en nube con HTTPS y MySQL on-premise por red privada o túnel cifrado (D-23).
- Respaldo diario cifrado y restauración cronometrada dentro de RPO 24 h / RTO 4 h (D-23).
- Verificación de conservación indefinida: sin jobs de purga, archivo ni anonimización (D-21).
- Verificación de la operación offline en el entorno real: ventana de 7 días, conflictos y datos locales cifrados (D-14).
- Configuración de producción (HTTPS, CORS, secrets, logs, health).
- Runbook de operación, respaldo, restauración e incidentes.
- Manual de usuario breve.
- Capacitación/demostración.

### Archivos esperados

```text
docs/operacion.md
docs/respaldo-y-restauracion.md
docs/manual-usuario.md
docs/seguridad.md
scripts/backup.sh
scripts/restore.sh
.github/workflows/ci.yml
frontend/e2e/
backend/test/
```

### Criterios de aceptación

- E2E-01/02/03 aprobados.
- Sin vulnerabilidades críticas/altas abiertas o excepción documentada.
- Performance dentro de objetivos o limitaciones documentadas.
- Migración y restauración probadas.
- HTTPS y CORS configurados.
- Backups automáticos y restauración verificada.
- Runbook y manual listos.
- No hay secretos en el repositorio.

### Pruebas

- T-MIG-01 a T-MIG-10.
- T-SEC-01 a T-SEC-17.
- T-OFF-01 a T-OFF-12.
- T-PER-01 a T-PER-06.
- Accesibilidad.
- Simulacro de restauración.

### Riesgos

| Riesgo | Mitigación |
|---|---|
| Diferencias entre desarrollo y producción | Misma versión MySQL/Node; configuración por entorno. |
| Backup no restaurable | Simulacro obligatorio. |
| Cámara solo en HTTPS | Certificado y prueba en dominio real. |
| Adopción operativa | Manual, capacitación y datos de ejemplo. |

### Verificación

```bash
npm run verify
npm run e2e
npm run test:perf
# Restauración en base limpia
./scripts/restore.sh <backup>
```

---

## 16. Hitos y puertas de aprobación

| Hito | Fase | Qué debe aprobar el propietario |
|---|---|---|
| H0 | 0 | Documentos, decisiones bloqueantes, stack y alcance del MVP. |
| H1 | 1 | Modelo de datos, restricciones y estrategia de códigos/fechas. |
| H2 | 2 | Roles/permisos y política de autenticación. |
| H3 | 4 | Flujo de alta, QR y etiqueta. |
| H4 | 5 | Reglas de movimientos y manejo de correcciones. |
| H5 | 6 | Política de mantenimiento/inspección y condición técnica. |
| H6 | 7 | Umbrales y reportes. |
| H7 | 10 | Aceptación funcional del MVP. |
| H8 | 11 | Aceptación de la operación sin conexión y sus conflictos. |
| H9 | 12 | Autorización de producción. |

Cada puerta requiere evidencia de pruebas y revisión de los documentos actualizados.

---

## 17. Riesgos transversales

| Riesgo | Probabilidad | Impacto | Mitigación | Responsable |
|---|---|---|---|---|
| Reglas técnicas no confirmadas | Baja | Medio | D-10/D-11/D-12/D-19 aprobadas; no inventar; configuración explícita. | Propietario/seguridad |
| Datos existentes de baja calidad | Media | Alto | D-24; dry-run; reporte de errores. | Almacén/administración |
| Permisos ambiguos | Media | Alto | D-07; matriz; pruebas 403. | Propietario |
| Concurrencia/doble envío | Media | Alto | Bloqueo, versión, idempotencia, pruebas. | Desarrollo |
| Cámara/HTTPS/hardware | Media | Medio | Fallback manual; pruebas reales. | Operaciones |
| Zona horaria/fechas | Media | Medio | UTC + `DATE`; pruebas de borde. | Desarrollo |
| Crecimiento de datos | Baja/Media | Medio | Índices, paginación, archivo. | Desarrollo/operaciones |
| Pérdida de datos | Baja | Muy alto | Backups, restauración probada. | Operaciones |
| Conflictos al sincronizar offline | Media | Medio | Rechazo completo, UI de conflicto y pruebas T-OFF. | Desarrollo/operaciones |
| Scope creep | Alta | Medio | Congelar MVP; backlog fase 2. | Propietario |
| Adopción del personal | Media | Alto | UX simple, capacitación, manual. | Operaciones |

---

## 18. Backlog de segunda fase (no MVP)

- Adjuntos, fotos, firmas y actas.
- Exportación PDF/Excel.
- Notificaciones por correo.
- Importación masiva y conciliación.
- Cabecera de lote con documento único (la selección múltiple ya está en el MVP con movimientos individuales, D-25).
- Catálogo administrable de condiciones.
- Corrección de inspecciones/servicios desde UI.
- Alertas de retornos pendientes.
- Reportes de costos.
- Multi-tenant.
- SSO.
- Integraciones.

Cada elemento requiere su propio análisis de alcance, seguridad y pruebas; no se implementa “de paso”.

---

## 19. Primer paso propuesto tras la aprobación

1. Responder las decisiones bloqueantes (empezando por D-03, D-04, D-05 y D-07).
2. Aprobar este plan y el alcance del MVP.
3. Autorizar **solo la fase 0**.
4. Al cerrar la fase 0 con evidencia, autorizar la **fase 1**.
5. No se escribe código de módulos funcionales hasta cerrar las puertas H0/H1.

**Lo que no se hará en esta sesión:** implementar backend/frontend, crear migraciones, generar datos de producción o declarar pruebas aprobadas. El repositorio sigue sin código de aplicación.
