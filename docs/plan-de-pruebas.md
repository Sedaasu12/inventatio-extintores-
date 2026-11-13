# Plan de pruebas — SITE

> **Estado:** propuesta para revisión. **No se ha ejecutado ninguna prueba en esta sesión** porque el repositorio aún no contiene código, base de datos ni configuración de test. Este documento define qué se probará, cómo y con qué criterio de aceptación.
>
> **Regla:** no se declarará una prueba como aprobada sin ejecutar el comando y registrar el resultado real (fecha, entorno, salida resumida y evidencia).

---

## 1. Objetivos

1. Verificar las reglas de negocio críticas, no solo el “camino feliz”.
2. Demostrar atomicidad de movimientos y actualización de estado/ubicación.
3. Demostrar que el historial no se pierde ni se duplica.
4. Verificar autorización en backend, incluso con llamadas directas a la API.
5. Verificar que las fechas y alertas no inventan datos.
6. Verificar QR, cámara, lector USB y entrada manual.
7. Verificar migración desde cero, restauración de respaldo y rendimiento básico.
8. Dejar trazabilidad entre requisito, caso de prueba y evidencia.

---

## 2. Estrategia por niveles

| Nivel | Herramienta propuesta | Alcance | Base de datos |
|---|---|---|---|
| Unitario | Jest (NestJS) | Reglas puras: transiciones, cálculo de alertas, validadores, permisos, generación de código. | No |
| Integración | Jest + Supertest + MySQL 8 de test | Servicios, transacciones, restricciones, concurrencia, idempotencia. | MySQL real, aislada |
| Contrato | OpenAPI + validación de esquemas | Formato de respuestas, códigos de error, campos obligatorios. | No |
| E2E | Playwright | Flujos completos en navegador con API real. | MySQL de test |
| Seguridad | Pruebas de autorización, validación, ZAP baseline opcional | 401/403, inyección, XSS, mass assignment, rate limit. | MySQL de test |
| Rendimiento | k6 o script de carga | Listados, dashboard, alertas con volumen. | MySQL con datos sintéticos |
| Accesibilidad | axe-core + Playwright | Formularios, foco, contraste, teclado. | E2E |
| Migración/respaldo | Prisma + scripts | Base vacía, migración, seed, restauración. | MySQL de test |

### 2.1 Reglas de aislamiento

- Cada prueba de integración usa una base de datos de test dedicada y limpia (transacción rollback o truncado controlado).
- Nunca se ejecutan pruebas destructivas contra desarrollo compartido o producción.
- Los datos de seed son ficticios y están marcados como desarrollo.
- Las pruebas concurrentes usan conexiones independientes, no el mismo cliente Prisma.

---

## 3. Datos de prueba

### 3.1 Usuarios

| Alias | Rol | Estado | Uso |
|---|---|---|---|
| `admin.test` | `ADMIN` | Activo | Configuración, ajustes, auditoría. |
| `almacen.test` | `ALMACEN` | Activo | Altas, salidas, traslados, envíos. |
| `seguridad.test` | `SEGURIDAD` | Activo | Inspecciones, servicios, condición, bajas. |
| `consulta.test` | `CONSULTA` | Activo | Lectura y pruebas 403. |
| `inactivo.test` | `CONSULTA` | Inactivo | Login rechazado. |

### 3.2 Ubicaciones

Estructura D-02: `SEDE` es la raíz; `ALMACEN`, `TALLER` y `AREA` son hijos. Los códigos los genera el servidor.

- `Sede Lima` (SEDE, `UBI-000001`)
- `Almacén central` (ALMACEN, hija de Sede Lima, `UBI-000002`)
- `Taller propio` (TALLER, hija de Sede Lima, `UBI-000003`)
- `Sede Norte` (SEDE, `UBI-000004`)
- `Área de producción` (AREA, hija de Sede Norte, `UBI-000005`)
- `Área de administración` (AREA, hija de Sede Norte, `UBI-000006`)

### 3.3 Catálogos

- Tipo `PQS-6KG` (agente PQS, capacidad nominal 6 kg).
- Tipo `CO2-5LB` (agente CO2, capacidad nominal 5 lb).
- Proveedor `TALLER-UNO` (activo).
- Proveedor `TALLER-DOS` (inactivo).
- Umbrales de alerta: sin configurar por defecto; en pruebas específicas se configuran valores ficticios (ej. 30 días) y se identifican como datos de prueba.

### 3.4 Activos

- `EXT-000001`: en almacén, operativo, con fechas documentadas.
- `EXT-000002`: asignado en área, observado.
- `EXT-000003`: en mantenimiento externo con orden abierta.
- `EXT-000004`: dado de baja.
- `EXT-000005`: sin fechas técnicas configuradas.
- `EXT-000006`: sin número de serie.
- Activos adicionales generados para volumen (10 000) en pruebas de rendimiento.

---

## 4. Casos por flujo

### 4.1 Autenticación y autorización

| ID | Nivel | Precondición | Acción | Resultado esperado | Requisito |
|---|---|---|---|---|---|
| T-AUT-01 | Integración | Usuario activo | Login con credenciales válidas | 200; access token; permisos; cookie refresh `HttpOnly`. | RF-AUT-01 |
| T-AUT-02 | Integración | — | Login con contraseña incorrecta | 401 genérico; no revela si el correo existe; auditoría de fallo. | RF-AUT-01/08 |
| T-AUT-03 | Integración | Usuario inactivo | Login | 401; no emite tokens. | RF-AUT-04 |
| T-AUT-04 | Integración | Sesión activa | Refresh | Nuevo access token; refresh rotado; el anterior queda revocado. | RF-AUT-02 |
| T-AUT-05 | Integración | Refresh ya rotado | Reutilizar refresh anterior | 401; se revoca la familia; no se emite token. | RF-AUT-02 |
| T-AUT-06 | Integración | Sesión activa | Logout | 204; refresh revocado; access token deja de ser aceptado si se consulta `/me` con sesión revocada. | RF-AUT-02 |
| T-AUT-07 | Integración | `consulta.test` | POST movimiento | 403; no se crea movimiento. | RF-AUT-06 |
| T-AUT-08 | Integración | — | 6 intentos de login fallidos en 1 min | 429 con `Retry-After`; no bloqueo permanente por defecto. | RF-AUT-07 |
| T-AUT-09 | Integración | Usuario creado | Inspeccionar DB | `password_hash` no es texto plano; algoritmo/costo verificable. | RNF-01 |
| T-AUT-10 | Integración | Sesión activa | Cambiar contraseña | Éxito; sesiones previas revocadas según política; auditoría. | RF-AUT-03 |
| T-AUT-11 | Unitario | Doble del proveedor de identidad | Resolver identidad y emitir sesión | La sesión y los permisos no dependen del proveedor; cambiar `LOCAL` por un doble no altera el resultado. | D-06 / BR-171/176 |
| T-AUT-12 | Integración | Sin sesión | `POST /users` | 401/403; no existe autorregistro. | BR-175 |
| T-AUT-13 | Integración | Usuario desactivado con access token vigente | `GET /auth/me` | 401; el token deja de ser aceptado. | BR-169/BR-178 |
| T-AUT-14 | Integración | `almacen.test` | `POST /extinguishers/:id/condition` | 403; la condición no cambia. | D-27 / BR-167 |
| T-AUT-15 | Unitario | Contraseña de 11 caracteres | Crear/cambiar contraseña | 422; se exige mínimo 12. | D-06b / BR-179A |
| T-AUT-16 | Unitario | Contraseña común de la lista | Crear/cambiar contraseña | 422; se rechaza. | D-06b / BR-179B |
| T-AUT-17 | Integración | Contraseña de 12 caracteres sin símbolos | Crear/cambiar contraseña | 200; no se exige composición. | D-06b / BR-179A |
| T-AUT-18 | Integración | `ADMIN` resetea contraseña | Siguiente login del usuario | Acceso permitido y cambio obligatorio; auditoría sin contraseña. | D-06b / BR-179C |

### 4.2 Ubicaciones y catálogos

| ID | Nivel | Acción | Resultado esperado | Requisito |
|---|---|---|---|---|
| T-UBI-01 | Integración | Crear SEDE y luego un AREA hija | 201; dos niveles; relaciones correctas. | RF-UBI-01 / D-02 |
| T-UBI-02 | Integración | Crear código duplicado | El código lo genera el servidor; el cliente no puede enviarlo. | RF-UBI-01 / D-02 |
| T-UBI-03 | Integración | Asignar un área como padre de otra área | 422 `LOCATION_DEPTH`; sin cambios. | BR-027A |
| T-UBI-04 | Integración | Desactivar ubicación con activos | 409 o desactivación controlada; no deja activos apuntando a ubicación inactiva sin regla. | RF-UBI-04 |
| T-UBI-05 | Integración | Mover activo a ubicación inactiva | 422; sin cambios. | BR-025 |
| T-UBI-06 | Integración | Crear tipo/proveedor con código duplicado | 409. | RF-UBI-05/06 |
| T-UBI-07 | Integración | Enviar a proveedor inactivo | 422 `PROVIDER_INVALID`. | BR-026 |
| T-UBI-08 | Integración | Crear ALMACEN, TALLER o AREA sin `parentId` | 422; el padre es obligatorio. | BR-027B |
| T-UBI-09 | Integración | Crear SEDE con `parentId` | 422; la sede es raíz. | BR-027B |
| T-UBI-10 | Integración | Repetir nombre dentro de la misma sede | 409; sin cambios. | BR-027D |
| T-UBI-11 | Integración | Repetir nombre en sedes distintas | 201; se permite. | BR-027D |
| T-UBI-12 | Integración | Enviar o intentar cambiar `code` | 422 o campo ignorado; el código es generado e inmutable. | BR-027C |
| T-UBI-13 | Integración | Usar una SEDE como ubicación actual de un extintor | 422; solo almacén, taller o área alojan activos. | BR-027A |

### 4.3 Alta, ficha y código

| ID | Nivel | Acción | Resultado esperado | Requisito |
|---|---|---|---|---|
| T-EXT-01 | Integración | Alta válida en almacén | 201; `asset_code` generado; `INGRESO` secuencia 1; estado `EN_ALMACEN`; fechas objetivo creadas; auditoría. | RF-EXT-01/02, RF-MOV-01 |
| T-EXT-02 | Integración | Alta en área interna | 201; estado `ASIGNADO`; `INGRESO` a área. | BR-036 |
| T-EXT-03 | Integración | Dos altas concurrentes | Códigos distintos, sin colisión; ambas transacciones consistentes. | RF-EXT-02 |
| T-EXT-04 | Integración | Intentar editar `asset_code` | 422/409; el código no cambia. | BR-002 |
| T-EXT-05 | Integración | PATCH con `currentLocationId` | 422; la ubicación no cambia. | BR-030 |
| T-EXT-06 | Integración | PATCH de marca/modelo | 200; auditoría con antes/después; ubicación intacta. | RF-EXT-07 |
| T-EXT-07 | Integración | Cambiar condición técnica sin motivo | 422. | RF-EXT-08 |
| T-EXT-08 | Integración | Cambiar condición técnica con motivo y permiso | 200; auditoría; ubicación intacta. | RF-EXT-08 |
| T-EXT-09 | Unitario | Validar fechas imposibles | Rechazo o confirmación según regla; no se guarda una fecha futura de fabricación. | RF-EXT-04 |
| T-EXT-10 | Integración | Alta enviando `assetCode` | 422 o campo rechazado; el código lo genera el servidor (D-04). | BR-003 |
| T-EXT-11 | Unitario | Generación de código | Formato `EXT-000001`, padding correcto, sin reutilización. | RF-EXT-02 |
| T-EXT-12 | Integración | Búsqueda/filtros/paginación | Resultados correctos; filtros en servidor; no carga todo el inventario. | RF-EXT-06 |
| T-EXT-13 | Unitario | Enviar condición `EN_REVISION` o texto libre | 422; solo se aceptan los cuatro valores del enum (D-26). | BR-012A |
| T-EXT-14 | Integración | `SEGURIDAD` cambia condición sin documento | 200; auditoría con anterior/nuevo y motivo; la evidencia documental es opcional. | D-27 / BR-167A |
| T-EXT-15 | Integración | Alta en área con `NO_OPERATIVO` | 422 `CONDITION_NOT_ASSIGNABLE`; no se crea el activo. | D-26b / BR-014A |
| T-EXT-16 | Integración | Alta en almacén con `NO_OPERATIVO` | 201; estado `EN_ALMACEN`. | D-26b / BR-014B |
| T-EXT-17 | Integración | Alta en área con `OBSERVADO` | 201; se permite con advertencia. | D-26b / BR-014C |
| T-EXT-18 | Unitario | Tipo con `usefulLifeYears = 10` y fabricación 2015-01-01 | Fecha calculada `2025-01-01`. | D-12 / BR-107B |
| T-EXT-19 | Unitario | Tipo sin `usefulLifeYears` o activo sin `manufactureDate` | No se calcula fecha; no se inventa un periodo. | D-12 / BR-107B |
| T-EXT-20 | Integración | Fecha documentada 2028 y calculada 2025 | La categoría `EQUIPO` usa 2025 (la más temprana). | D-12 / BR-107C |
| T-EXT-21 | Integración | Cambiar `usefulLifeYears` de un tipo | Recalcula `EQUIPO` de sus equipos; auditoría; no toca otras categorías. | D-12 / BR-107E |

### 4.4 QR y escaneo

| ID | Nivel | Acción | Resultado esperado | Requisito |
|---|---|---|---|---|
| T-QR-01 | Integración | Resolver `EXT-000001` autenticado | 200; ficha correcta. | RF-QR-01, RF-EXT-10 |
| T-QR-02 | Integración | Resolver código inexistente | 404; no crea activo. | RF-QR-05 |
| T-QR-03 | Integración | Resolver código de activo dado de baja | 200 con estado `DADO_DE_BAJA`; sin acciones ordinarias. | BR-144 |
| T-QR-04 | Integración | Resolver sin token | 401. | BR-142 |
| T-QR-05 | Integración | Superar rate limit de resolución | 429 con `Retry-After`. | BR-145 |
| T-QR-06 | E2E | Cámara denegada | Mensaje claro; ofrece entrada manual/lector; no bloquea la app. | RF-QR-01/03 |
| T-QR-07 | E2E | Lector USB escribe código + Enter | Resuelve ficha; no duplica por Enter repetido. | RF-QR-02 |
| T-QR-08 | E2E | Entrada manual válida | Resuelve ficha. | RF-QR-03 |
| T-QR-09 | Unitario | Inspeccionar payload QR | Solo código/URL estable; sin ubicación, fechas, nombres ni PII. | BR-140/141 |
| T-QR-10 | E2E | Lectura rápida/doble clic | Un solo movimiento/confirmación; idempotencia. | RF-QR-04 |

### 4.5 Movimientos

| ID | Nivel | Acción | Resultado esperado | Requisito |
|---|---|---|---|---|
| T-MOV-01 | Integración | `SALIDA` desde almacén correcto | 201; estado `ASIGNADO`; origen/destino correctos; historial. | RF-MOV-02 |
| T-MOV-02 | Integración | `SALIDA` con origen incorrecto | 409 `ORIGIN_MISMATCH`; estado intacto. | RF-MOV-09 |
| T-MOV-03 | Integración | `SALIDA` a almacén | 422; usar `TRASLADO`/`RETORNO` según corresponda. | BR-064 |
| T-MOV-04 | Integración | `TRASLADO` área→área | 201; estado `ASIGNADO`. | RF-MOV-03 |
| T-MOV-05 | Integración | `TRASLADO` almacén→almacén | 201; estado `EN_ALMACEN`. | BR-065 |
| T-MOV-06 | Integración | `RETORNO_ALMACEN` desde área | 201; estado `EN_ALMACEN`. | RF-MOV-04 |
| T-MOV-07 | Integración | Movimiento sobre activo en mantenimiento | 409 `INVALID_TRANSITION`. | BR-032 |
| T-MOV-08 | Integración | Movimiento sobre activo dado de baja | 409 `ASSET_RETIRED`. | BR-033 |
| T-MOV-09 | Integración | Falta `received_by` en salida | 422; no se crea. | BR-050 |
| T-MOV-10 | Integración | Falta `reason` | 422. | BR-049 |
| T-MOV-11 | Integración | Fecha futura > 5 min | 422 `DATE_IN_FUTURE`. | BR-056 |
| T-MOV-12 | Integración | Fecha anterior al último movimiento | 422; se indica usar ajuste. | BR-055 |
| T-MOV-13 | Integración | Reintento con misma `Idempotency-Key` | Devuelve el mismo movimiento; no crea otro. | RF-MOV-13 |
| T-MOV-14 | Integración | Misma clave, payload distinto | 409 `IDEMPOTENCY_CONFLICT`. | BR-059 |
| T-MOV-15 | Integración | Dos salidas concurrentes del mismo activo | Una se confirma; la otra devuelve 409; secuencia única; estado coherente. | RF-MOV-14 |
| T-MOV-16 | Integración | Fallo simulado tras insertar movimiento | Rollback: no queda movimiento ni cambio de estado. | RF-MOV-10 |
| T-MOV-17 | Integración | Fallo simulado tras actualizar estado | Rollback: no queda cambio sin movimiento. | RF-MOV-10 |
| T-MOV-18 | Integración | Renombrar ubicación después de un movimiento | El historial conserva el snapshot; la ficha muestra el nombre actual. | BR-041 |
| T-MOV-19 | Integración | `AJUSTE` por `ALMACEN` | 403. | BR-071 |
| T-MOV-20 | Integración | `AJUSTE` por `ADMIN` con motivo/documento | 201; proyección corregida; original conservado. | RF-MOV-08 |
| T-MOV-21 | Integración | Baja válida | 201; `DADO_DE_BAJA`; colocación `NONE`; historial; excluido de operativos. | RF-MOV-07 |
| T-MOV-22 | Integración | Baja con orden activa | 409/422; no se permite por defecto. | BR-069 |
| T-MOV-23 | Integración | Movimiento posterior a baja | 409. | BR-054 |
| T-MOV-24 | Integración | Historial paginado/ordenado | Orden correcto por secuencia/fecha; sin huecos. | RF-MOV-11/15 |
| T-MOV-25 | Integración | Mover un equipo `NO_OPERATIVO` a un `AREA` | 422 `CONDITION_NOT_ASSIGNABLE`; sin cambios. | D-26b / BR-014A |
| T-MOV-26 | Integración | Mover un equipo `NO_OPERATIVO` a almacén o taller | 201; destino permitido. | D-26b / BR-014B |
| T-MOV-27 | Integración | Cambiar a `NO_OPERATIVO` un equipo `ASIGNADO` en área | 422; indica retirarlo primero a almacén o taller. | D-26b / BR-014D |

### 4.6 Mantenimiento

| ID | Nivel | Acción | Resultado esperado | Requisito |
|---|---|---|---|---|
| T-MAN-01 | Integración | Enviar a mantenimiento | 201; orden `EN_PROVEEDOR`; movimiento; estado `EN_MANTENIMIENTO`; colocación externa. | RF-MAN-01 |
| T-MAN-02 | Integración | Segundo envío con orden activa | 409 `MAINTENANCE_ORDER_ACTIVE`. | RF-MAN-08 |
| T-MAN-03 | Integración | Enviar a proveedor inactivo | 422. | BR-026 |
| T-MAN-04 | Integración | Retorno sin servicio | 422 `MAINTENANCE_SERVICE_REQUIRED`; estado intacto. | RF-MAN-04 |
| T-MAN-05 | Integración | Servicio `RECARGA` con `next_due_date` | Actualiza solo `RECARGA`, no mantenimiento/prueba. | BR-087 |
| T-MAN-06 | Integración | Servicio sin `next_due_date` | Elimina la fecha objetivo de esa categoría; `SIN_FECHA_CONFIGURADA`. | BR-088 |
| T-MAN-07 | Integración | Servicio retroactivo anterior | No reemplaza la fecha objetivo vigente. | BR-111 |
| T-MAN-08 | Integración | Servicio posterior | Reemplaza la fecha objetivo. | BR-112 |
| T-MAN-09 | Integración | Retorno con servicio aprobado | Orden cerrada; movimiento de retorno; estado según destino; condición `OPERATIVO`. | RF-MAN-05 |
| T-MAN-10 | Integración | Retorno con resultado `RECHAZADO` | Condición `NO_OPERATIVO`; orden cerrada; historial. | RF-MAN-05 |
| T-MAN-11 | Integración | Retorno con proveedor distinto | 409; no cierra. | BR-067 |
| T-MAN-12 | Integración | Retorno antes del envío/servicio | 422. | BR-091 |
| T-MAN-13 | Integración | Servicio interno sin orden | 201; actualiza fechas; auditoría. | RF-MAN-03 |
| T-MAN-14 | Integración | Orden cerrada recibe servicio/retorno | 409. | RF-MAN-09 |
| T-MAN-15 | Unitario | El resultado del servicio no altera la condición | Tras un servicio aprobado o rechazado, la condición permanece; el cambio explícito sí queda auditado | RF-MAN-05 / BR-089 |
| T-MAN-16 | Unitario | Servicio a las 02:00 UTC (21:00 local) con próxima fecha al día siguiente local | `performed_on` es la fecha local correcta; `next_due_date` válida. | BR-113 |

### 4.7 Inspecciones

| ID | Nivel | Acción | Resultado esperado | Requisito |
|---|---|---|---|---|
| T-INS-01 | Integración | Inspección válida con próxima fecha | 201; fecha objetivo `INSPECCION` actualizada. | RF-INS-01/02 |
| T-INS-02 | Integración | Inspección sin próxima fecha | Fecha objetivo eliminada; `SIN_FECHA_CONFIGURADA`. | RF-INS-02 |
| T-INS-03 | Integración | Próxima fecha anterior a inspección | 422. | RF-INS-03 |
| T-INS-04 | Integración | Inspección no cambia condición | Condición intacta. | RF-INS-05 |
| T-INS-05 | Integración | Inspección por `ALMACEN` | 403. | RF-AUT-06 |
| T-INS-06 | Integración | Inspección retroactiva | No reemplaza una inspección posterior vigente. | BR-111 |
| T-INS-07 | Integración | Corrección (fase 2) | Nueva fila con `corrects_id`; original conservado. | RF-INS-06 |
| T-INS-08 | Unitario | Inspección a las 02:00 UTC (21:00 local) con próxima fecha al día siguiente local | `inspected_on` es la fecha local correcta; `next_due_date` válida. | BR-101 |
| T-INS-09 | Integración | Inspección con resultado `RECHAZADO` | La condición técnica **no** cambia; la ficha muestra el último resultado; el cambio exige la acción de D-27. | D-28 / BR-103 |

### 4.8 Alertas

| ID | Nivel | Acción | Resultado esperado | Requisito |
|---|---|---|---|---|
| T-ALE-01 | Unitario | Fecha ayer | `VENCIDO`. | RF-ALE-02 |
| T-ALE-02 | Unitario | Fecha hoy | `POR_VENCER`. | BR-122 |
| T-ALE-03 | Unitario | Fecha dentro del umbral | `POR_VENCER`; días restantes correctos. | RF-ALE-02 |
| T-ALE-04 | Unitario | Fecha fuera del umbral | `VIGENTE`. | RF-ALE-02 |
| T-ALE-05 | Unitario | Sin umbral configurado | Hoy → `POR_VENCER`; futura → `VIGENTE`; no se inventa periodo. | BR-125 |
| T-ALE-06 | Integración | Activo sin fecha documentada | `SIN_FECHA_CONFIGURADA`; no se inventa fecha. | RF-ALE-08 |
| T-ALE-07 | Integración | Activo dado de baja | Excluido por defecto; incluido con filtro explícito. | RF-ALE-05 |
| T-ALE-08 | Integración | Categoría deshabilitada | No aparece en alertas operativas. | BR-130 |
| T-ALE-09 | Integración | Repetir consulta de alertas | Mismos resultados; no se duplican filas. | RF-ALE-06 |
| T-ALE-10 | Unitario | Borde de zona horaria | El cálculo usa `America/Lima`; no cambia por UTC del servidor. | RNF/BR-109 |
| T-ALE-11 | Integración | Cambiar umbral | Reclasifica; no cambia fechas fuente; auditoría. | RF-ALE-03 |
| T-ALE-12 | Integración | Umbral negativo | 422. | BR-129 |
| T-ALE-13 | Unitario | `EQUIPO` con documentada y calculada | Se usa la más temprana; el estado se calcula sobre esa fecha. | D-12 / BR-107C |
| T-ALE-14 | Integración | `EQUIPO` solo con calculada | Alerta correcta desde `manufactureDate + usefulLifeYears`. | D-12 / BR-107B |
| T-ALE-15 | Integración | `EQUIPO` sin documentada ni calculable | `SIN_FECHA_CONFIGURADA`; no se inventa fecha. | D-12 / RF-ALE-08 |

### 4.9 Dashboard, reportes y auditoría

| ID | Nivel | Acción | Resultado esperado | Requisito |
|---|---|---|---|---|
| T-DASH-01 | Integración | Consultar resumen | Conteos coinciden con datos; bajas excluidas. | RF-DASH-01..04 |
| T-REP-01 | Integración | Inventario por ubicación/estado | Totales y filas consistentes; paginación. | RF-REP-01 |
| T-REP-02 | Integración | Movimientos por periodo/tipo | Filtros y totales correctos. | RF-REP-02 |
| T-REP-03 | Integración | Exportar CSV con permiso | Archivo válido; sin datos de más; sin permiso 403. | RF-REP-05 |
| T-AUD-01 | Integración | Alta/edición/movimiento | Auditoría con actor, entidad, antes/después, request ID. | RF-AUD-01..03 |
| T-AUD-02 | Integración | Intentar editar/borrar auditoría | No existe endpoint; DB restringe; 404/405. | RF-AUD-04 |
| T-AUD-03 | Integración | Revisar auditoría | No contiene contraseñas, tokens ni secretos. | BR-182 |

---

### 4.10 Casos añadidos por las decisiones aprobadas (2026-11-10)

| ID | Nivel | Acción | Resultado esperado | Regla |
|---|---|---|---|---|
| T-ENTRY-01 | Integración | Alta directa en área con `entrySource` y motivo | Estado `ASIGNADO`; `INGRESO` con `entry_source`; sin movimiento de paso por almacén | D-03 / BR-037 |
| T-ENTRY-02 | Unit/Integración | Alta sin `entrySource` | 422; no se crea activo ni movimiento | D-03 / BR-037A |
| T-ENTRY-03 | Integración | Alta en almacén con `COMPRA_CENTRAL` | Estado `EN_ALMACEN`; historial inicia en almacén | D-03 / BR-036 |
| T-ENTRY-04 | Integración | Alta con `assetCode` en el cuerpo | 422 o campo ignorado explícitamente; el código lo genera el servidor | D-04 |
| T-SAL-01 | Integración | Salida a sede | Ubicación actual = destino; sin estado `EN_TRANSITO`; receptor y documento registrados | D-09 / BR-064A |
| T-MNT-01 | Integración | Envío a taller interno | `EN_MANTENIMIENTO` con colocación `INTERNAL` en `TALLER`; sin `documentRef` obligatorio | D-31 / BR-022A |
| T-MNT-02 | Integración | Envío a proveedor externo sin `documentRef` | 422 | D-18 / BR-051 |
| T-MNT-03 | Integración | Retorno con resultado `APROBADO` | La condición técnica **no** cambia; queda evidencia del servicio | D-10 / BR-089 |
| T-COND-01 | Integración | Cambio de condición sin motivo o sin permiso | 422 / 403; con permiso y motivo, auditoría | BR-167 |
| T-SER-01 | Integración | Alta con serial duplicado | Se acepta; se devuelve advertencia y aparece en reporte de duplicados | D-16 |
| T-QR-01 | Unit | Generar payload de etiqueta | Solo `asset_code`; sin URL, ubicación, fechas ni PII | D-05 / BR-140 |

---

## 5. Pruebas de transacción y concurrencia (detalle)

### 5.1 Fallo atómico

**Método:** inyectar un fallo controlado en el paso posterior a la inserción del movimiento (por ejemplo, un mock del servicio de auditoría o una restricción temporal) y verificar:

- `movements` no tiene la fila.
- `extinguishers` conserva estado/colocación/versión anteriores.
- `maintenance_orders` no quedó creada.
- `due_dates` no cambió.
- No hay auditoría de una operación inexistente.

Repetir para fallo después de actualizar el extintor y antes de insertar la auditoría.

### 5.2 Concurrencia

| ID | Escenario | Resultado esperado |
|---|---|---|
| T-CON-01 | Dos `SALIDA` simultáneas del mismo activo | Una 201; una 409; una sola fila; secuencia sin duplicado. |
| T-CON-02 | Dos envíos a mantenimiento simultáneos | Una orden activa; la otra 409; sin doble movimiento. |
| T-CON-03 | Dos altas simultáneas | Códigos distintos; sin colisión; contador correcto. |
| T-CON-04 | Dos inspecciones simultáneas | Ambas se registran; la proyección usa la fecha/creación posterior; sin corrupción. |
| T-CON-05 | Reintento idempotente simultáneo | Una operación; ambas respuestas coherentes. |
| T-CON-06 | Deadlock transitorio | Reintento limitado; no duplica; error controlado si persiste. |

### 5.3 Verificación de invariantes

Después de cada operación, ejecutar consultas de verificación:

- `EN_ALMACEN` ⇒ ubicación tipo `ALMACEN`.
- `ASIGNADO` ⇒ ubicación tipo `AREA`.
- `EN_MANTENIMIENTO` interno ⇒ ubicación tipo `TALLER`.
- Una `SEDE` no puede ser ubicación actual de un extintor.
- `ASIGNADO` ⇒ `technical_condition <> 'NO_OPERATIVO'` (D-26b).
- `EN_MANTENIMIENTO` ⇒ contraparte externa + orden activa.
- `DADO_DE_BAJA` ⇒ `placement_type='NONE'`, FKs nulas, `retired_at` no nulo.
- Secuencia de movimientos sin huecos.
- Una sola orden activa por activo.
- `due_dates` sin duplicados por activo/categoría.

### 5.4 Idempotencia

| ID | Escenario | Resultado esperado |
|---|---|---|
| T-IDM-01 | Reintento de alta con la misma clave | Misma ficha, mismo `INGRESO`; no se duplica. |
| T-IDM-02 | Alta con misma clave y payload distinto | 409; no se crea nada. |
| T-IDM-03 | Reintento de inspección con la misma clave | Una sola inspección; misma fecha objetivo. |
| T-IDM-04 | Reintento de servicio con la misma clave | Un solo servicio; sin duplicar fechas. |
| T-IDM-05 | Reintento de envío/retorno de mantenimiento | Una sola orden/movimiento; respuesta coherente. |
| T-IDM-06 | Fallo de transacción con clave registrada | El registro se revierte; la clave puede reutilizarse. |

---

## 6. Pruebas de seguridad

| ID | Prueba | Resultado esperado |
|---|---|---|
| T-SEC-01 | Invocar endpoints sin token | 401. |
| T-SEC-02 | Invocar con token de rol sin permiso | 403; sin efectos. |
| T-SEC-03 | Enviar `createdBy`, `currentLocationId`, `logisticsStatus` en DTO | 422; no se aplican. |
| T-SEC-04 | Inyección SQL en búsqueda/filtros | Prisma parametriza; no se ejecuta SQL; sin error interno. |
| T-SEC-05 | XSS en nombre/notas | Se escapa en UI; no ejecuta script. |
| T-SEC-06 | Fuerza bruta de login | Rate limit 429; no bloqueo permanente por defecto. |
| T-SEC-07 | Reutilización de refresh | 401; familia revocada. |
| T-SEC-08 | CORS desde origen no permitido | Bloqueado. |
| T-SEC-09 | Error interno | Respuesta genérica con request ID; sin stack/SQL. |
| T-SEC-10 | Access token en `localStorage` | Revisión de frontend: no se usa; memoria/refresh cookie. |
| T-SEC-11 | Contraseña en logs/auditoría | No aparece. |
| T-SEC-12 | Enumeración de correos | Login no revela existencia. |
| T-SEC-13 | CSRF en refresh | `SameSite=Strict` + validación de origen; no acepta peticiones cruzadas. |
| T-SEC-14 | Fuerza bruta de códigos QR | Rate limit; no revela datos sin autenticación. |
| T-SEC-15 | Dependencias vulnerables | `npm audit` sin críticos/altos abiertos o con excepción documentada. |

---

## 7. Pruebas de rendimiento

| ID | Escenario | Objetivo |
|---|---|---|
| T-PER-01 | 10 000 activos, listado paginado con filtros | p95 < 500 ms. |
| T-PER-02 | 100 000 movimientos, historial por activo | p95 < 300 ms. |
| T-PER-03 | Dashboard con 10 000 activos | < 1 s. |
| T-PER-04 | Consulta de alertas por categoría/fecha | p95 < 500 ms. |
| T-PER-05 | Búsqueda por código/QR | p95 < 200 ms. |
| T-PER-06 | Exportación CSV de 10 000 filas | < 10 s; streaming si es necesario. |

Verificar `EXPLAIN` de las consultas principales y que se usen los índices definidos. Los umbrales son objetivos iniciales; se ajustan con el volumen real (D-22).

---

## 8. Pruebas de accesibilidad y usabilidad

- Navegación completa por teclado en login, alta, ficha, movimiento y escaneo.
- Foco visible y orden lógico.
- Etiquetas asociadas a campos; mensajes de error anunciados.
- Contraste WCAG 2.1 AA.
- Formularios utilizables a 360 px de ancho.
- Estados de carga, vacío y error claros.
- Cámara denegada: alternativa visible y comprensible.
- Lector USB: el campo correcto recibe el foco; no se pierde el código.
- Confirmación antes de baja/ajuste; no doble envío.

---

## 9. Pruebas de migración, respaldo y restauración

| ID | Prueba | Resultado esperado |
|---|---|---|
| T-MIG-01 | `prisma migrate deploy` desde base vacía | Migración completa; tablas, enums, índices y constraints. |
| T-MIG-02 | `prisma migrate deploy` desde versión anterior | Migración incremental sin pérdida de datos. |
| T-MIG-03 | `prisma validate` | Esquema válido. |
| T-MIG-04 | Seed de desarrollo | Datos ficticios; no umbrales/fechas inventadas. |
| T-MIG-05 | Restaurar backup en base limpia | Datos y relaciones consistentes; app funciona. |
| T-MIG-06 | Reinicio con datos de prueba | App y pruebas E2E funcionan. |
| T-MIG-07 | Verificar constraints | Intentos de violar unicidad/placement/órdenes activas fallan. |

---

## 10. E2E de punta a punta

### E2E-01 — Ciclo completo principal

1. `ADMIN` inicia sesión.
2. Crea sede, almacén, área, tipo y proveedor.
3. `ALMACEN` da de alta un extintor en almacén; se genera QR.
4. Imprime/visualiza etiqueta; escanea por entrada manual.
5. Registra salida al área; verifica ficha e historial.
6. `SEGURIDAD` registra inspección con próxima fecha; verifica alerta.
7. `ALMACEN` envía a mantenimiento; verifica estado externo.
8. `SEGURIDAD` registra servicio con certificado y próxima fecha.
9. Registra retorno al almacén; verifica cierre de orden, estado y fechas.
10. Configura umbral; verifica alerta `POR_VENCER`.
11. `SEGURIDAD`/`ADMIN` da de baja; verifica que desaparece de operativos y conserva historial.
12. `CONSULTA` intenta crear movimiento; recibe 403.
13. `ADMIN` revisa auditoría.

### E2E-02 — Errores y recuperación

- Cámara denegada → entrada manual.
- Código inexistente → aviso, sin alta.
- Origen incorrecto → error, sin cambios.
- Doble clic en confirmar → un solo movimiento.
- Pérdida de red simulada → mensaje de error; no se muestra éxito falso.
- Refresh token expirado → login o refresh correcto, sin bucle.

### E2E-03 — Permisos

- `CONSULTA` solo lectura.
- `ALMACEN` no puede baja/ajuste.
- `SEGURIDAD` puede inspección/servicio; no administra usuarios.
- `ADMIN` administra todo.
- Usuario inactivo no accede.

---

## 11. Matriz de trazabilidad resumida

| Flujo | Requisitos | Pruebas clave |
|---|---|---|
| Alta e ingreso | RF-EXT-01/02, RF-MOV-01 | T-EXT-01/02/03, T-MOV-16, E2E-01 |
| Salida | RF-MOV-02/09 | T-MOV-01/02/03, T-CON-01 |
| Traslado | RF-MOV-03 | T-MOV-04/05 |
| Retorno almacén | RF-MOV-04 | T-MOV-06 |
| Mantenimiento | RF-MAN-01..09, RF-MOV-05/06 | T-MAN-01..15, E2E-01 |
| Inspección | RF-INS-01..06 | T-INS-01..06 |
| Alertas | RF-ALE-01..09 | T-ALE-01..15 |
| Baja | RF-MOV-07 | T-MOV-21/22/23, E2E-01 |
| Ajuste | RF-MOV-08 | T-MOV-19/20 |
| QR | RF-QR-01..06 | T-QR-01..10 |
| Permisos | RF-AUT-06 | T-AUT-07, T-SEC-02, E2E-03 |
| Auditoría | RF-AUD-01..05 | T-AUD-01..03 |
| Migración | RNF-08/09 | T-MIG-01..07 |

---

## 12. Comandos de verificación (previstos)

> Estos comandos se ejecutarán cuando exista el proyecto. **No se han ejecutado todavía.**

### Backend

```bash
npm run lint
npm run typecheck
npm run test
npm run test:integration
npm run build
npx prisma validate
npx prisma migrate deploy
```

### Frontend

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run e2e
```

### Raíz / base de datos

```bash
docker compose up -d db
npm run db:reset
npm run db:seed
npm run verify
```

Si un script no existe, se debe crear o documentar su ausencia; no se afirmará que la verificación pasó.

---

## 13. Registro de evidencia

Cada ejecución debe registrar:

| Campo | Contenido |
|---|---|
| Fecha/hora | UTC y hora local. |
| Entorno | Commit, versiones de Node/Angular/Nest/MySQL, SO. |
| Comando | Comando exacto. |
| Resultado | Código de salida, resumen, número de pruebas aprobadas/fallidas. |
| Evidencia | Log o captura, sin secretos ni PII real. |
| Incidencias | Enlace/descripción y decisión. |

Formato sugerido: `docs/evidencias/AAAA-MM-DD-fase.md` (se crea en la fase 0).

---

## 14. Criterios de aceptación de una fase

1. Lint, typecheck, pruebas y build ejecutados y aprobados, o excepciones documentadas.
2. Migración desde cero ejecutada.
3. Pruebas de la regla nueva (camino feliz y rechazo) ejecutadas.
4. Pruebas de transacción/concurrencia cuando aplique.
5. E2E del flujo afectado cuando aplique.
6. Documentación de API/operación actualizada.
7. Sin secretos, datos personales reales ni datos de producción en fixtures.
8. Limitaciones conocidas registradas.

---

## 15. Limitaciones actuales

- No hay código ni entorno de pruebas: **0 pruebas ejecutadas**.
- Los umbrales, intervalos y fechas de prueba son ficticios y deben reemplazarse por datos aprobados.
- Las pruebas de cámara/lector requieren hardware y HTTPS; se simulan en E2E y se validan manualmente en el entorno real.
- Las pruebas de rendimiento requieren una base con volumen sintético; aún no existe.
- La política de retención, respaldo y RPO/RTO debe confirmarse.
- La matriz de permisos es una propuesta; debe aprobarse antes de las pruebas de autorización definitivas.
