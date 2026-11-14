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
| 11 | E2E, seguridad, rendimiento y despliegue | Fase 10 | L | Suite completa, hardening, backups, runbook. |

**MVP demostrable:** fases 0–10. **Listo para producción:** fase 11 aprobada.

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
- D-01 (single/multi-tenant), D-02 (ubicaciones, aprobada), D-15 (zona horaria), D-26 (enum de condición, aprobada).

### Alcance

- `schema.prisma` con todas las entidades del MVP: usuarios, roles, permisos, refresh tokens, idempotencia, ubicaciones, tipos, proveedores, extintores, movimientos, órdenes, servicios, inspecciones, fechas objetivo, umbrales, auditoría, contadores.
- Cambios aprobados a incluir: `LocationType` del MVP reducido a `SEDE`, `ALMACEN`, `AREA` y `TALLER`; dos niveles con nombre único por sede (D-02); `movements.entry_source`, `maintenance_orders.provider_id` nullable + `workshop_location_id` con `CHECK` de exclusividad (D-31).
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
backend/prisma/seed-data/
backend/src/prisma/prisma.module.ts
backend/src/prisma/prisma.service.ts
docs/modelo-entidad-relacion.md
```

### Criterios de aceptación

- `prisma validate` sin errores.
- `prisma migrate deploy` desde base vacía crea todas las tablas, enums, FKs e índices.
- Restricciones C-01 a C-14 verificadas con pruebas de integración.
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

---

## 8. Fase 5 — Motor de movimientos

### Objetivo

Implementar el corazón de la trazabilidad: movimientos atómicos, validación de origen, historial inmutable y control de concurrencia.

### Dependencias

- Fase 4.
- D-08 (evidencia, aprobada), D-08b (sin segunda aprobación, aprobada), D-09 (tránsito), D-17 (baja), D-26b (efecto de la condición).

### Alcance

- Servicio único de movimientos con bloqueo de fila, secuencia, snapshots e idempotencia.
- `SALIDA`, `TRASLADO`, `RETORNO_ALMACEN`, `BAJA`, `AJUSTE`.
- Validación de máquina de estados y campos obligatorios.
- Rechazo de destino `AREA` para equipos `NO_OPERATIVO` y de cambio a `NO_OPERATIVO` mientras están asignados (D-26b).
- Historial por activo y global.
- `row_version` y manejo de 409.
- Auditoría transaccional.
- Endpoint de baja y ajuste; ambos se ejecutan directamente con permiso, motivo, `authorizedBy` y `documentRef`, sin flujo de aprobación (D-08b).

### Archivos esperados

```text
backend/src/modules/movements/
backend/src/modules/movements/dto/
backend/src/modules/movements/movement-policy.ts
backend/src/modules/movements/movement.service.ts
backend/test/movements.e2e-spec.ts
backend/test/movements-concurrency.e2e-spec.ts
backend/test/movements-transaction.e2e-spec.ts
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
npm run test -- movements
npm run test:e2e -- movements
npm run test:integration -- movements-concurrency
npm run lint && npm run typecheck && npm run build
```

---

## 9. Fase 6 — Mantenimiento, inspecciones y fechas objetivo

### Objetivo

Cubrir el ciclo técnico: envío/retorno de mantenimiento, servicios, inspecciones y actualización de fechas objetivo.

### Dependencias

- Fase 5.
- D-10 (condición, aprobada), D-13 (evidencia textual, aprobada: sin archivos), D-18 (documentos), D-28 (inspección/condición, aprobada: sin cambio automático).

### Alcance

- Órdenes de mantenimiento y servicios.
- Envío y retorno transaccionales.
- Una sola orden activa por activo.
- Servicio obligatorio para retorno.
- Servicios internos.
- Inspecciones.
- Idempotencia en servicios e inspecciones.
- Proyección `due_dates` con comparación por fecha de evento.
- Mapeo de condición técnica según resultado.
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
- Entorno de API por configuración.

### Archivos esperados

```text
frontend/src/app/core/auth/
frontend/src/app/core/api/
frontend/src/app/core/permissions/
frontend/src/app/shared/components/
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

## 14. Fase 11 — E2E, seguridad, rendimiento y despliegue

### Objetivo

Pasar de “funciona en desarrollo” a “operable con seguridad y respaldo”.

### Dependencias

- Fase 10.
- D-21 (retención), D-23 (hosting/backup).

### Alcance

- Suite E2E completa y estable.
- Pruebas de seguridad y autorización.
- Pruebas de rendimiento con volumen sintético.
- Revisión de accesibilidad.
- Migración desde cero y desde versión anterior.
- Backup/restauración probada.
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

- T-MIG-01 a T-MIG-07.
- T-SEC-01 a T-SEC-15.
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

## 15. Hitos y puertas de aprobación

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
| H8 | 11 | Autorización de producción. |

Cada puerta requiere evidencia de pruebas y revisión de los documentos actualizados.

---

## 16. Riesgos transversales

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
| Scope creep | Alta | Medio | Congelar MVP; backlog fase 2. | Propietario |
| Adopción del personal | Media | Alto | UX simple, capacitación, manual. | Operaciones |

---

## 17. Backlog de segunda fase (no MVP)

- Adjuntos, fotos, firmas y actas.
- Exportación PDF/Excel.
- Notificaciones por correo.
- Importación masiva y conciliación.
- Lotes de movimiento.
- PWA/offline.
- Catálogo administrable de condiciones.
- Corrección de inspecciones/servicios desde UI.
- Alertas de retornos pendientes.
- Reportes de costos.
- Multi-tenant.
- SSO.
- Integraciones.

Cada elemento requiere su propio análisis de alcance, seguridad y pruebas; no se implementa “de paso”.

---

## 18. Primer paso propuesto tras la aprobación

1. Responder las decisiones bloqueantes (empezando por D-03, D-04, D-05 y D-07).
2. Aprobar este plan y el alcance del MVP.
3. Autorizar **solo la fase 0**.
4. Al cerrar la fase 0 con evidencia, autorizar la **fase 1**.
5. No se escribe código de módulos funcionales hasta cerrar las puertas H0/H1.

**Lo que no se hará en esta sesión:** implementar backend/frontend, crear migraciones, generar datos de producción o declarar pruebas aprobadas. El repositorio sigue sin código de aplicación.
