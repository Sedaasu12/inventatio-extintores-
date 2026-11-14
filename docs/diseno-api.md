# Diseño de API REST y estructura de módulos — SITE

> **Estado:** propuesta para revisión. Base: `/api/v1`. Formato: JSON UTF-8. Autenticación: Bearer JWT + refresh token rotativo en cookie `HttpOnly`.
>
> **Contrato:** este documento define la intención. La fuente ejecutable será OpenAPI 3.1 generado/validado en la fase 2 y versionado en `docs/api/openapi.yaml`.

---

## 1. Convenciones

| Tema | Decisión |
|---|---|
| Base URL | `/api/v1` |
| Fechas/hora | ISO 8601 con offset en entrada; el backend convierte a UTC. Salida en UTC con `Z` y campos auxiliares de zona si se requieren. |
| Fechas calendario | `YYYY-MM-DD`; sin conversión de zona. |
| IDs | UUID en string. |
| Nombres JSON | `camelCase`. |
| Nombres DB | `snake_case` (mapeados con Prisma). |
| Paginación | `page` (1..N), `pageSize` (1..100, default 20). |
| Orden | `sort` con whitelist por endpoint, ej. `-movedAt`, `assetCode`. |
| Filtros | Query params explícitos; no se aceptan filtros SQL libres. |
| Idempotencia | Header `Idempotency-Key` (UUID) en POST críticos. |
| Desconocidos | Rechazo de campos no declarados (`forbidNonWhitelisted`). |
| Errores | `{ "error": { "code", "message", "details?", "requestId" } }`. |
| Autorización | Permiso verificado en backend en cada endpoint. |
| CORS | Lista blanca por variable de entorno; no `*` en producción. |
| Tamaño de cuerpo | 1 MB por defecto; adjuntos en fase 2 con límites propios. |

### 1.1 Códigos HTTP

| Código | Uso |
|---:|---|
| 200 | Consulta o actualización exitosa. |
| 201 | Recurso creado. |
| 204 | Operación sin cuerpo (logout, desactivación). |
| 400 | JSON malformado o query inválida. |
| 401 | No autenticado/token inválido. |
| 403 | Autenticado sin permiso. |
| 404 | Recurso inexistente. |
| 409 | Conflicto de estado, concurrencia, idempotencia u origen. |
| 422 | Validación de negocio/DTO. |
| 429 | Rate limit. |
| 500 | Error interno no controlado. |
| 503 | Dependencia no disponible (DB/correo futuro). |

### 1.2 Formato de listas

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

### 1.3 Formato de error

```json
{
  "error": {
    "code": "ORIGIN_MISMATCH",
    "message": "El origen indicado no coincide con la ubicación actual del extintor.",
    "details": [
      { "field": "originLocationId", "expected": "loc-123", "received": "loc-456" }
    ],
    "requestId": "0f5c2c8e-6d8f-4d4e-9e6b-2a1f6f7c9a10"
  }
}
```

No se devuelven stack traces, SQL, nombres de tablas ni datos de otros activos.

---

## 2. Autenticación y sesión

### 2.1 Flujo

1. `POST /auth/login` con correo/contraseña.
2. El servidor verifica Argon2id/bcrypt, emite access token (15 min) y refresh token (7 días) en cookie `HttpOnly`, `Secure`, `SameSite=Strict`.
3. El frontend guarda el access token **en memoria** (no en `localStorage`).
4. `POST /auth/refresh` rota el refresh token y emite un nuevo access token.
5. `POST /auth/logout` revoca el refresh actual.
6. Un refresh revocado o reutilizado invalida la familia de tokens y devuelve 401.

> **Proveedor de identidad (D-06 opción C):** el login valida la identidad a través de un `AuthProvider`. El MVP incluye solo el proveedor `LOCAL`; el contrato de sesión (tokens, permisos, auditoría) no depende de él. Si se adopta OIDC, se añaden rutas de redirección y callback, y el resto de la API no cambia.

### 2.2 Endpoints de autenticación

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| POST | `/auth/login` | Público (rate limit) | Inicia sesión. |
| POST | `/auth/refresh` | Refresh cookie | Renueva access token y rota refresh. |
| POST | `/auth/logout` | Autenticado | Revoca refresh y limpia cookie. |
| GET | `/auth/me` | Autenticado | Perfil, roles y permisos efectivos. |
| POST | `/auth/change-password` | Autenticado | Cambia contraseña propia. |
| POST | `/users/:id/reset-password` | `users.manage` | Reset administrativo; obliga cambio. |

> **Política de contraseñas (D-06b):** 12–128 caracteres; sin reglas de composición ni caducidad forzada; se rechazan contraseñas comunes de una lista local; el reset es solo administrativo y obliga cambio; sin autoservicio por correo ni MFA en el MVP.

### 2.3 Ejemplo de login

```json
POST /api/v1/auth/login
{
  "email": "almacen@example.test",
  "password": "una-contraseña-de-prueba"
}
```

```json
200 OK
Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth
{
  "accessToken": "eyJ...",
  "expiresIn": 900,
  "user": {
    "id": "8a4b...",
    "email": "almacen@example.test",
    "fullName": "Usuario de Almacén",
    "roles": ["ALMACEN"],
    "permissions": ["extinguishers.read", "movements.create", "..."]
  }
}
```

---

## 3. Permisos

### 3.1 Códigos de permiso

| Permiso | Agrupación |
|---|---|
| `dashboard.read` | Dashboard |
| `users.read`, `users.manage` | Usuarios |
| `roles.manage` | Roles |
| `locations.read`, `locations.manage` | Ubicaciones |
| `catalogs.read`, `catalogs.manage` | Tipos, proveedores |
| `extinguishers.read`, `extinguishers.create`, `extinguishers.update` | Ficha |
| `extinguishers.condition` | Cambio de condición técnica |
| `extinguishers.retire` | Baja |
| `movements.read`, `movements.create`, `movements.adjust` | Movimientos |
| `maintenance.read`, `maintenance.manage` | Órdenes y servicios |
| `inspections.read`, `inspections.create` | Inspecciones |
| `alerts.read`, `alerts.settings` | Alertas y umbrales |
| `reports.read`, `reports.export` | Reportes |
| `audit.read` | Auditoría |

### 3.2 Matriz de roles propuesta

| Permiso | `ADMIN` | `ALMACEN` | `SEGURIDAD` | `CONSULTA` |
|---|:---:|:---:|:---:|:---:|
| `dashboard.read` | ✓ | ✓ | ✓ | ✓ |
| `users.read/manage`, `roles.manage` | ✓ | | | |
| `locations.read` | ✓ | ✓ | ✓ | ✓ |
| `locations.manage` | ✓ | | | |
| `catalogs.read` | ✓ | ✓ | ✓ | ✓ |
| `catalogs.manage` | ✓ | | | |
| `extinguishers.read` | ✓ | ✓ | ✓ | ✓ |
| `extinguishers.create` | ✓ | ✓ | | |
| `extinguishers.update` | ✓ | ✓ | ✓* | |
| `extinguishers.condition` | ✓ | | ✓ | |
| `extinguishers.retire` | ✓ | | ✓ | |
| `movements.read` | ✓ | ✓ | ✓ | ✓ |
| `movements.create` | ✓ | ✓ | ✓** | |
| `movements.adjust` | ✓ | | | |
| `maintenance.read` | ✓ | ✓ | ✓ | ✓ |
| `maintenance.manage` | ✓ | ✓ | ✓ | |
| `inspections.read` | ✓ | ✓ | ✓ | ✓ |
| `inspections.create` | ✓ | | ✓ | |
| `alerts.read` | ✓ | ✓ | ✓ | ✓ |
| `alerts.settings` | ✓ | | | |
| `reports.read` | ✓ | ✓ | ✓ | ✓ |
| `reports.export` | ✓ | | ✓ | |
| `audit.read` | ✓ | | | ✓ |

\* `SEGURIDAD` actualiza campos técnicos, no ubicación/estado.
\** `SEGURIDAD` crea movimientos vinculados a mantenimiento; la matriz definitiva debe confirmarse (D-07).

Los roles son una agrupación de permisos; el backend verifica permisos, no nombres de rol. La matriz es una semilla editable por `ADMIN`.

---

## 4. Catálogo de endpoints

### 4.1 Usuarios y roles

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/users` | `users.read` | Lista paginada; filtros por activo/rol. |
| POST | `/users` | `users.manage` | Crea usuario; contraseña temporal. |
| GET | `/users/:id` | `users.read` | Detalle. |
| PATCH | `/users/:id` | `users.manage` | Nombre, estado, roles; no borra. |
| POST | `/users/:id/deactivate` | `users.manage` | Desactiva y revoca sesiones. |
| POST | `/users/:id/reset-password` | `users.manage` | Reset temporal. |
| GET | `/roles` | `users.read` | Lista de roles. |
| GET | `/permissions` | `users.read` | Catálogo de permisos. |
| PUT | `/roles/:id/permissions` | `roles.manage` | Reemplaza permisos del rol. |

### 4.2 Ubicaciones y catálogos

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/locations` | `locations.read` | Lista o árbol; `tree=true`, `active`. |
| POST | `/locations` | `locations.manage` | Crea ubicación; `parentId` obligatorio salvo para `SEDE`; el código lo genera el servidor. |
| GET | `/locations/:id` | `locations.read` | Detalle con padre e hijos. |
| PATCH | `/locations/:id` | `locations.manage` | Nombre, dirección y, si no hay activos ni historial, el padre. Tipo y código son inmutables. |
| POST | `/locations/:id/deactivate` | `locations.manage` | Desactiva si no hay activos ni dependencias incompatibles. |
| GET | `/locations/:id/extinguishers` | `extinguishers.read` | Inventario de la ubicación; en una sede incluye sus almacenes, taller y áreas. |
| GET | `/extinguisher-types` | `catalogs.read` | Tipos activos/inactivos. |
| POST | `/extinguisher-types` | `catalogs.manage` | Crea tipo. |
| PATCH | `/extinguisher-types/:id` | `catalogs.manage` | Edita/desactiva; cambiar `usefulLifeYears` recalcula `EQUIPO` y audita (D-12). |
| GET | `/external-parties` | `catalogs.read` | Proveedores/talleres. |
| POST | `/external-parties` | `catalogs.manage` | Crea contraparte. |
| PATCH | `/external-parties/:id` | `catalogs.manage` | Edita/desactiva. |

### 4.3 Extintores, QR y etiquetas

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/extinguishers` | `extinguishers.read` | Lista paginada con filtros. |
| POST | `/extinguishers` | `extinguishers.create` | Alta + `INGRESO` + fechas objetivo. Requiere `Idempotency-Key`. |
| GET | `/extinguishers/:id` | `extinguishers.read` | Ficha completa con resumen de alertas y orden activa. |
| GET | `/extinguishers/by-code/:assetCode` | `extinguishers.read` | Resolución de QR/manual; rate limit. |
| PATCH | `/extinguishers/:id` | `extinguishers.update` | Campos descriptivos/técnicos; rechaza ubicación, estado y condición técnica; requiere `rowVersion`. |
| POST | `/extinguishers/:id/condition` | `extinguishers.condition` | Cambio de condición técnica con motivo; solo `SEGURIDAD` y `ADMIN` (D-27); `condition` es un enum fijo, no texto libre (D-26); si el activo está `ASIGNADO`, pasar a `NO_OPERATIVO` devuelve 422 `CONDITION_NOT_ASSIGNABLE` (D-26b). |
| GET | `/extinguishers/:id/movements` | `movements.read` | Historial paginado. |
| GET | `/extinguishers/:id/timeline` | `movements.read` | Movimientos + inspecciones + servicios (segunda fase si se complica). |
| GET | `/extinguishers/:id/qr` | `extinguishers.read` | PNG/SVG del QR; query `format`, `size`. |
| GET | `/extinguishers/:id/label` | `extinguishers.read` | HTML/PDF de etiqueta; PDF en segunda fase. |
| POST | `/extinguishers/:id/retire` | `extinguishers.retire` | Baja; crea movimiento `BAJA` directamente, sin segunda aprobación; exige `authorizedBy`, motivo y `documentRef` (D-08b). Requiere `Idempotency-Key`. |
| POST | `/extinguishers/:id/adjustments` | `movements.adjust` | Ajuste excepcional directo, sin segunda aprobación; exige `authorizedBy`, motivo y `documentRef` (D-08b). Requiere `Idempotency-Key`. |

#### Filtros de `GET /extinguishers`

`q` (código/serie/marca/modelo), `assetCode`, `serialNumber`, `typeId`, `locationId`, `includeDescendants=true|false`, `logisticsStatus`, `technicalCondition`, `alertEventType`, `alertStatus`, `includeRetired=false`, `page`, `pageSize`, `sort`.

#### Ejemplo de alta

```json
POST /api/v1/extinguishers
Idempotency-Key: 4e8d0c2a-9f2b-4c1a-8f3e-1b2c3d4e5f60
{
  "assetCode": null,
  "serialNumber": "SN-2025-001",
  "typeId": "6c1f...",
  "brand": "ACME",
  "model": "PQS-6",
  "capacityValue": 6,
  "capacityUnit": "KG",
  "manufactureDate": "2025-01-15",
  "acquiredAt": "2025-02-01",
  "commissionedAt": "2025-02-10",
  "manufacturerExpiryDate": "2035-01-15",
  "initialLocationId": "2d9a...",
  "technicalCondition": "OPERATIVO",
  "notes": "Equipo nuevo."
}
```

```json
201 Created
{
  "id": "a1b2...",
  "assetCode": "EXT-000125",
  "qrPayload": "EXT-000125",
  "extinguisher": {
    "id": "a1b2...",
    "assetCode": "EXT-000125",
    "logisticsStatus": "EN_ALMACEN",
    "technicalCondition": "OPERATIVO",
    "placementType": "INTERNAL",
    "currentLocation": { "id": "2d9a...", "code": "UBI-000002", "name": "Almacén central" },
    "currentSince": "2026-11-10T20:30:00.000Z"
  },
  "movement": {
    "id": "m1...",
    "type": "INGRESO",
    "assetSequence": 1,
    "movedAt": "2026-11-10T20:30:00.000Z"
  }
}
```

> `assetCode` no se acepta como entrada: lo genera el servidor. Tampoco se importan códigos en el MVP (D-04 aprobada); la carga inicial de equipos existentes (D-24) genera código nuevo para cada uno.

### 4.4 Movimientos

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/movements` | `movements.read` | Lista global con filtros. |
| GET | `/movements/:id` | `movements.read` | Detalle inmutable. |
| POST | `/extinguishers/:id/movements` | `movements.create` | `SALIDA`, `TRASLADO`, `RETORNO_ALMACEN`. Requiere `Idempotency-Key`. |
| POST | `/extinguishers/:id/maintenance/send` | `maintenance.manage` | Crea orden + `ENVIO_MANTENIMIENTO`. Requiere `Idempotency-Key`. |
| POST | `/maintenance-orders/:id/services` | `maintenance.manage` | Registra servicio. Requiere `Idempotency-Key`. |
| POST | `/maintenance-orders/:id/return` | `maintenance.manage` | `RETORNO_MANTENIMIENTO` + cierre de orden. Requiere `Idempotency-Key`. |
| GET | `/maintenance-orders` | `maintenance.read` | Órdenes; filtros por estado/proveedor/retorno previsto. |
| GET | `/maintenance-orders/:id` | `maintenance.read` | Orden, servicios y movimientos. |

`POST /extinguishers/:id/movements` **no acepta** `INGRESO` (solo alta), `ENVIO_MANTENIMIENTO`, `RETORNO_MANTENIMIENTO`, `BAJA` ni `AJUSTE`; cada uno tiene su flujo dedicado para validar reglas específicas.

#### Ejemplo de salida

```json
POST /api/v1/extinguishers/a1b2.../movements
Idempotency-Key: 0b0d... 
{
  "type": "SALIDA",
  "originLocationId": "2d9a...",
  "destinationLocationId": "7e4c...",
  "movedAt": "2026-11-10T15:30:00-05:00",
  "requestedBy": "Juan Pérez",
  "authorizedBy": "María López",
  "deliveredBy": "Juan Pérez",
  "receivedBy": "Carlos Ruiz",
  "reason": "Instalación en sede Lima",
  "documentRef": "ACTA-2026-001",
  "notes": "Entrega en recepción.",
  "rowVersion": 3
}
```

```json
201 Created
{
  "movement": {
    "id": "mv...",
    "type": "SALIDA",
    "assetSequence": 4,
    "origin": { "kind": "LOCATION", "id": "2d9a...", "label": "Almacén central" },
    "destination": { "kind": "LOCATION", "id": "7e4c...", "label": "Sede Lima - Área de producción" },
    "movedAt": "2026-11-10T20:30:00.000Z",
    "createdAt": "2026-11-10T20:31:02.000Z"
  },
  "extinguisher": {
    "id": "a1b2...",
    "logisticsStatus": "ASIGNADO",
    "currentLocationId": "7e4c...",
    "currentSince": "2026-11-10T20:30:00.000Z",
    "rowVersion": 4
  }
}
```

#### Ejemplo de envío a mantenimiento

```json
POST /api/v1/extinguishers/a1b2.../maintenance/send
Idempotency-Key: 6a7b...
{
  "providerId": "9f1c...",
  "expectedReturnDate": "2026-12-01",
  "movedAt": "2026-11-12T09:00:00-05:00",
  "authorizedBy": "María López",
  "deliveredBy": "Juan Pérez",
  "reason": "Mantenimiento anual y recarga",
  "documentRef": "GUIA-2026-0042",
  "notes": "Se entrega en taller.",
  "rowVersion": 4
}
```

Respuesta: `201` con `maintenanceOrder`, `movement` y `extinguisher` actualizado (`EN_MANTENIMIENTO`, colocación externa o interna en taller).

> Si el servicio es interno, el cuerpo usa `workshopLocationId` en lugar de `providerId`; el movimiento tiene origen y destino `LOCATION` y no exige `documentRef` (D-31, D-18).

#### Ejemplo de servicio y retorno

```json
POST /api/v1/maintenance-orders/mo1.../services
{
  "serviceType": "RECARGA",
  "performedAt": "2026-11-20T11:00:00-05:00",
  "providerId": "9f1c...",
  "result": "APROBADO",
  "certificateNo": "CERT-2026-778",
  "certificateDate": "2026-11-20",
  "nextDueDate": "2027-11-20",
  "notes": "Recarga según certificado.",
  "documentRef": "CERT-2026-778"
}
```

```json
POST /api/v1/maintenance-orders/mo1.../return
Idempotency-Key: 7b8c...
{
  "destinationLocationId": "2d9a...",
  "movedAt": "2026-11-21T10:00:00-05:00",
  "receivedBy": "Juan Pérez",
  "reason": "Retorno de mantenimiento",
  "documentRef": "ACTA-RET-2026-011",
  "notes": "Equipo recibido conforme.",
  "rowVersion": 5
}
```

### 4.5 Inspecciones

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/inspections` | `inspections.read` | Lista global; filtros. |
| POST | `/extinguishers/:id/inspections` | `inspections.create` | Registra inspección y actualiza fecha objetivo; no cambia la condición técnica (D-28). Requiere `Idempotency-Key`. |
| GET | `/inspections/:id` | `inspections.read` | Detalle. |
| POST | `/inspections/:id/corrections` | `inspections.create` | Corrección como nuevo registro (fase 2). |

#### Ejemplo

```json
POST /api/v1/extinguishers/a1b2.../inspections
{
  "inspectedAt": "2026-11-10T10:00:00-05:00",
  "inspectorName": "Ana Torres",
  "inspectorUserId": null,
  "result": "APROBADO_CON_OBSERVACIONES",
  "checklist": {
    "presion": "OK",
    "precinto": "OK",
    "senalizacion": "OBSERVADA",
    "acceso": "OK"
  },
  "nextDueDate": "2027-05-10",
  "notes": "Se solicita reponer señalización.",
  "documentRef": "INS-2026-0456"
}
```

Respuesta `201` con inspección y fecha objetivo actualizada; no cambia la condición técnica.

### 4.6 Alertas y configuración

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/alerts` | `alerts.read` | Alertas calculadas; filtros por categoría/estado/ubicación. |
| GET | `/alerts/summary` | `alerts.read` | Conteos por categoría/estado. |
| GET | `/alert-settings` | `alerts.read` | Umbrales configurados; `daysBefore` puede ser `null` (sin umbral). |
| PUT | `/alert-settings/:eventType` | `alerts.settings` | Configura `daysBefore` y `enabled`; no se siembran valores por defecto (D-11). |
| GET | `/dashboard/summary` | `dashboard.read` | Totales, estados, condiciones, mantenimiento y alertas. |

#### Ejemplo de alertas

```json
GET /api/v1/alerts?eventType=INSPECCION&status=POR_VENCER&page=1&pageSize=20
```

```json
200 OK
{
  "data": [
    {
      "extinguisherId": "a1b2...",
      "assetCode": "EXT-000125",
      "location": { "id": "7e4c...", "name": "Sede Lima - Área de producción" },
      "eventType": "INSPECCION",
      "dueDate": "2026-11-25",
      "status": "POR_VENCER",
      "daysRemaining": 15,
      "sourceType": "INSPECTION",
      "sourceId": "i1...",
      "thresholdDays": 30,
      "thresholdConfigured": true
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 1, "totalPages": 1 }
}
```

`status` admitido: `VENCIDO`, `POR_VENCER`, `VIGENTE`, `SIN_FECHA_CONFIGURADA`. `eventType`: `EQUIPO`, `INSPECCION`, `MANTENIMIENTO`, `RECARGA`, `PRUEBA_HIDROSTATICA`.

> Para `EQUIPO`, la fecha objetivo es la más temprana entre la documentada (`manufacturerExpiryDate`) y la calculada (`manufactureDate + usefulLifeYears`) cuando ambas existen (D-12). Si no hay ninguna, la categoría queda `SIN_FECHA_CONFIGURADA`.

> **Sin cálculo de intervalos (D-11):** las categorías `INSPECCION`, `MANTENIMIENTO`, `RECARGA` y `PRUEBA_HIDROSTATICA` usan solo el `nextDueDate` indicado; el servidor no calcula la próxima fecha sumando periodos. Si no se indica, la categoría queda sin fecha.

### 4.7 Reportes

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/reports/inventory` | `reports.read` | Inventario por ubicación/estado/condición. |
| GET | `/reports/movements` | `reports.read` | Movimientos por periodo/tipo/usuario. |
| GET | `/reports/maintenance` | `reports.read` | Órdenes, servicios y retornos pendientes. |
| GET | `/reports/inspections` | `reports.read` | Inspecciones y próximas fechas. |
| GET | `/reports/retired` | `reports.read` | Bajas y ajustes con motivo. |
| GET | `/reports/:type/export` | `reports.export` | CSV en el MVP; PDF/Excel en fase 2 (D-19). |

Todos los reportes usan filtros de servidor y paginación; los totales se calculan en SQL, no en el cliente. La consulta devuelve JSON y la exportación CSV usa los mismos filtros; no se generan ni almacenan archivos persistentes (D-19).

### 4.8 Auditoría y salud

| Método | Ruta | Permiso | Descripción |
|---|---|---|---|
| GET | `/audit-logs` | `audit.read` | Filtros por entidad, acción, usuario, fecha. |
| GET | `/health` | Público | Liveness; sin datos sensibles. |
| GET | `/health/ready` | Público interno | DB y dependencias. |
| GET | `/api/docs` | Restringido en producción | Swagger/OpenAPI. |

---

## 5. DTOs y validaciones

### 5.1 Reglas generales

- `class-validator` + `class-transformer`; `whitelist: true`, `forbidNonWhitelisted: true`.
- Strings recortados; longitudes máximas; no HTML sin sanitizar en campos mostrados.
- UUID válidos; fechas ISO 8601; enums estrictos.
- `reason` mínimo 5, máximo 500.
- Nombres de responsables mínimo 2, máximo 150.
- `documentRef` máximo 100.
- `notes` máximo 2000.
- `rowVersion` entero ≥ 1 en actualizaciones/movimientos cuando se envía.
- `Idempotency-Key` UUID; máximo 64 caracteres; se rechaza si falta en POST críticos.
- No se aceptan `createdBy`, `createdAt`, `currentLocationId`, `currentExternalPartyId`, `logisticsStatus`, `placementType`, `technicalCondition` (salvo el endpoint dedicado) ni `rowVersion` manipulable fuera de los DTOs previstos.

### 5.1a DTO de ubicación

| Campo | Tipo | Obligatorio | Regla |
|---|---|:---:|---|
| `name` | string | Sí | 2–150; recortado; único dentro de la sede, sin distinguir mayúsculas (D-02). |
| `type` | enum | Sí | `SEDE`, `ALMACEN`, `AREA` o `TALLER`. Inmutable después de crear. |
| `parentId` | UUID | Según tipo | Nulo/prohibido para `SEDE`; obligatorio y de tipo `SEDE` para los demás. |
| `address` | string | No | Máximo 255. |
| `code` | — | No | Lo genera el servidor (`UBI-000001`); no se acepta del cliente. |
| `active` | — | No | Se cambia solo por `/locations/:id/deactivate`; no se borra. |

Reglas de actualización: `PATCH` acepta `name`, `address` y, solo si la ubicación no tiene activos ni historial, `parentId`. Cambiar `type` exige crear otra ubicación; no se permite reinterpretar un área como almacén.

### 5.1b DTO de tipo de extintor

| Campo | Tipo | Obligatorio | Regla |
|---|---|---|:---:|---|
| `code` | string | Sí | Único; 2–20; no se reutiliza. |
| `name` | string | Sí | 2–100. |
| `agent` | string | Sí | Texto configurable (PQS, CO2, agua, espuma, etc.). |
| `nominalCapacity` | decimal | Sí | > 0. |
| `capacityUnit` | enum | Sí | `KG`, `L`, `LB`. |
| `usefulLifeYears` | int/null | No | Entero positivo, sin valor por defecto (D-12). Si es nulo, el tipo no genera fecha calculada. |
| `description` | string | No | Máx. 500. |
| `active` | boolean | No | Desactivación lógica; no se borra un tipo con equipos. |

Al cambiar `usefulLifeYears`, el servidor recalcula la fecha objetivo `EQUIPO` de los equipos del tipo dentro de la misma transacción y registra auditoría (D-12 / BR-107E).

### 5.2 DTO de alta

| Campo | Tipo | Obligatorio | Regla |
|---|---|:---:|---|
| `assetCode` | — | No | **No se acepta en el alta**: el servidor lo genera (D-04). |
| `serialNumber` | string/null | No | Máx. 100; no único; se advierte duplicado (D-16). |
| `typeId` | UUID | Sí | Tipo activo. |
| `brand`, `model` | string/null | No | Máx. 100. |
| `capacityValue` | decimal | Sí | > 0. |
| `capacityUnit` | enum | Sí | `KG`, `L`, `LB`. |
| `manufactureDate` | date | No | No futura. |
| `acquiredAt` | date | No | ≥ fabricación. |
| `commissionedAt` | date | No | ≥ adquisición. |
| `manufacturerExpiryDate` | date | No | ≥ fabricación; documentada por el fabricante. La categoría `EQUIPO` usa la más temprana entre esta y la calculada con `usefulLifeYears` (D-12). |
| `initialLocationId` | UUID | Sí | Activa, interna. Si no es `ALMACEN`, exige `entrySource` y motivo. |
| `entrySource` | enum | Sí | `COMPRA_CENTRAL`, `COMPRA_LOCAL`, `CARGA_INICIAL`, `RETORNO_MANTENIMIENTO`, `TRASLADO` (D-03). |
| `initialReason` | string | Sí | 5..500; motivo del ingreso y de la ubicación inicial. |
| `technicalCondition` | enum | Sí | `OPERATIVO`, `OBSERVADO`, `NO_OPERATIVO` o `PENDIENTE_INSPECCION`; sin valor por defecto (D-26). Si la ubicación inicial es un `AREA`, no puede ser `NO_OPERATIVO` (D-26b). |
| `notes` | string | No | Máx. 2000. |

### 5.3 DTO de movimiento

| Campo | Tipo | Obligatorio | Regla |
|---|---|:---:|---|
| `type` | enum | Sí | Solo tipos permitidos por el endpoint. |
| `entrySource` | enum | Solo `INGRESO` | Obligatorio al registrar un ingreso; prohibido en otros tipos. |
| `originLocationId` / `originExternalPartyId` | UUID | Según tipo | Debe coincidir con la colocación actual. |
| `destinationLocationId` / `destinationExternalPartyId` | UUID | Según tipo | Activo, distinto del origen, tipo correcto. |
| `movedAt` | datetime | Sí | Con offset; ≤ ahora + 5 min; ≥ alta; ≥ último movimiento normal. |
| `requestedBy`, `authorizedBy`, `deliveredBy`, `receivedBy` | string | Según matriz | Longitud 2..150; son **snapshots de nombre**, no usuarios (D-08b). |
| `reason` | string | Sí | 5..500. |
| `documentRef` | string | Según tipo | Obligatorio en `INGRESO`, mantenimiento externo, `BAJA` y `AJUSTE` (D-18, D-08b); máx. 100. |
| `notes` | string | No | Máx. 2000. |
| `rowVersion` | int | Recomendado | Si se envía y no coincide, 409. |

> **Sin flujo de aprobación (D-08b):** no existe endpoint de aprobación, estado `PENDIENTE` ni tabla de solicitudes. Quien tiene el permiso ejecuta el movimiento; `authorizedBy` registra el nombre de quien autoriza fuera del sistema. `BAJA` y `AJUSTE` siguen exigiendo permiso específico, motivo y `documentRef`; sin ellos la API responde 403 o 422.

> **Sin archivos (D-13):** el MVP no expone endpoints de subida, descarga ni firma. La evidencia documental se limita a `documentRef` textual (máx. 100). Los adjuntos, fotos y firma electrónica quedan para una fase posterior.

### 5.4 DTO de inspección/servicio

- `nextDueDate` debe ser posterior a la fecha local de `inspectedAt`/`performedAt`; el servidor deriva `inspectedOn`/`performedOn` en la zona configurada y no acepta esas fechas del cliente.
- `checklist` JSON con tamaño máximo (ej. 20 KB) y estructura validada por esquema.
- `result` enum estricto.
- `providerId` obligatorio si el servicio es externo; `workshopLocationId` y `performedByUserId` si es interno (D-31).
- `cost` ≥ 0; `currency` ISO 4217 de 3 letras.

---

## 6. Idempotencia y concurrencia

### 6.1 Idempotencia

- Header `Idempotency-Key` obligatorio en:
  - `POST /extinguishers`
  - `POST /extinguishers/:id/movements`
  - `POST /extinguishers/:id/maintenance/send`
  - `POST /maintenance-orders/:id/services`
  - `POST /maintenance-orders/:id/return`
  - `POST /extinguishers/:id/inspections`
  - `POST /extinguishers/:id/retire`
  - `POST /extinguishers/:id/adjustments`
- La clave se registra en `idempotency_records` con `UNIQUE(user_id, idempotency_key)` y `request_hash`.
- Si la clave existe con el mismo payload: devolver el recurso original con `200`/`201` y cabecera `Idempotent-Replay: true`.
- Si la clave existe con payload distinto: `409 IDEMPOTENCY_CONFLICT`.
- Si la operación falla antes de confirmar, la transacción revierte el registro y la clave puede reutilizarse.
- La limpieza de registros se ejecuta después de 24 h; no se reutilizan claves de operaciones completadas dentro de esa ventana.

### 6.2 Concurrencia

- Bloqueo `SELECT ... FOR UPDATE` sobre el extintor.
- `row_version` se incrementa en cada actualización.
- Conflicto: `409 CONCURRENCY_CONFLICT` con mensaje “recargue la ficha”.
- No se resuelve con “last write wins”.
- Pruebas concurrentes obligatorias.

---

## 7. Rate limits

| Endpoint | Límite propuesto |
|---|---|
| `POST /auth/login` | 5 intentos/min por IP + correo; bloqueo temporal progresivo. |
| `POST /auth/refresh` | 30/min por usuario/IP. |
| `GET /extinguishers/by-code/:code` | 60/min por usuario; 300/min por IP. |
| Escrituras de movimientos | 30/min por usuario. |
| Lecturas generales | 300/min por usuario. |
| Exportaciones | 5/min por usuario. |

Configurables por entorno. Respuesta `429` con `Retry-After`.

---

## 8. Estructura del backend (NestJS)

```text
backend/
  prisma/
    schema.prisma
    migrations/
    seed.ts
  src/
    main.ts
    app.module.ts
    config/
      configuration.ts
      validation.ts
    common/
      decorators/
        permissions.decorator.ts
        current-user.decorator.ts
      guards/
        jwt-auth.guard.ts
        permissions.guard.ts
      interceptors/
        audit.interceptor.ts
        request-id.interceptor.ts
        transform.interceptor.ts
      filters/
        http-exception.filter.ts
      errors/
        business-error.ts
        error-codes.ts
      dto/
        pagination.dto.ts
        date-range.dto.ts
      utils/
        dates.ts
        uuids.ts
    prisma/
      prisma.module.ts
      prisma.service.ts
    modules/
      auth/
        auth.module.ts
        auth.controller.ts
        auth.service.ts
        dto/
        strategies/
      users/
      locations/
      catalogs/
        extinguisher-types/
        external-parties/
      extinguishers/
      movements/
      maintenance/
      inspections/
      alerts/
      dashboard/
      reports/
      audit/
      health/
```

### 8.1 Módulos y responsabilidades

| Módulo | Responsabilidad |
|---|---|
| `auth` | Login, refresh, logout, hashing, tokens, guards. |
| `users` | Usuarios, roles, permisos. |
| `locations` | Árbol, ciclos, activación. |
| `catalogs` | Tipos de extintor y contrapartes externas. |
| `extinguishers` | Ficha, código, QR, condición, baja. |
| `movements` | Servicio transaccional de movimientos y ajustes. |
| `maintenance` | Órdenes, servicios, envío/retorno. |
| `inspections` | Inspecciones y fechas objetivo. |
| `alerts` | Cálculo, umbrales, resumen. |
| `dashboard` | Agregados de inicio. |
| `reports` | Consultas y exportación. |
| `audit` | Registro y consulta de auditoría. |
| `health` | Liveness/readiness. |

### 8.2 Reglas de implementación

- Los controladores no contienen reglas de negocio; delegan en servicios de dominio.
- Un único servicio de movimientos es el único autorizado a modificar la proyección de ubicación/estado.
- Los servicios de mantenimiento e inspección actualizan `due_dates` dentro de la misma transacción.
- El servicio de auditoría se invoca dentro de la transacción de la operación.
- No se usan consultas SQL concatenadas; Prisma o SQL parametrizado.
- Los errores de negocio usan códigos estables.

---

## 9. Estructura del frontend (Angular)

```text
frontend/
  src/
    app/
      core/
        auth/
          auth.service.ts
          auth.guard.ts
          permission.guard.ts
          auth.interceptor.ts
        api/
          api.service.ts
          error.interceptor.ts
          models/
        permissions/
          permission.service.ts
        qr/
          qr-scanner.service.ts
          qr-scanner.port.ts
      shared/
        components/
          page-header/
          data-table/
          status-chip/
          confirm-dialog/
          empty-state/
          pagination/
        directives/
          has-permission.directive.ts
        pipes/
          date-display.pipe.ts
      layout/
        app-shell/
        sidebar/
        topbar/
      features/
        auth/
          login/
          change-password/
        dashboard/
        extinguishers/
          list/
          detail/
          form/
          label/
        movements/
          movement-wizard/
          history/
        scan/
          scan-page/
          manual-code/
        locations/
        maintenance/
          order-list/
          order-detail/
          send/
          return/
        inspections/
          list/
          form/
        alerts/
          list/
          settings/
        reports/
        admin/
          users/
          roles/
          catalogs/
          audit/
      app.routes.ts
      app.config.ts
    environments/
```

### 9.1 Rutas principales

| Ruta | Componente | Guard |
|---|---|---|
| `/login` | Login | Público |
| `/app/dashboard` | Dashboard | Autenticado + `dashboard.read` |
| `/app/extintores` | Lista | `extinguishers.read` |
| `/app/extintores/nuevo` | Alta | `extinguishers.create` |
| `/app/extintores/:id` | Ficha | `extinguishers.read` |
| `/app/extintores/:id/movimiento/:tipo` | Wizard de movimiento | Según tipo |
| `/app/escanear` | Escáner | `extinguishers.read` |
| `/app/movimientos` | Historial global | `movements.read` |
| `/app/ubicaciones` | Árbol | `locations.read` |
| `/app/mantenimiento` | Órdenes | `maintenance.read` |
| `/app/inspecciones` | Inspecciones | `inspections.read` |
| `/app/alertas` | Alertas | `alerts.read` |
| `/app/reportes` | Reportes | `reports.read` |
| `/app/admin/...` | Administración | Permisos específicos |

### 9.2 Servicios y estado

- Angular standalone components, `provideRouter`, `provideHttpClient` con interceptores funcionales.
- Estado con signals y servicios; no NgRx en MVP.
- Formularios reactivos tipados; validación de cliente para UX y validación de servidor como fuente de verdad.
- Filtros y paginación reflejados en query params para compartir/enlazar vistas.
- `PermissionService` expone `has(permission)`; `hasPermission` directive oculta acciones, pero el backend decide.
- `AuthService` mantiene el access token en memoria y programa refresh antes de expirar; evita bucles de refresh.
- `ErrorInterceptor` traduce códigos estables a mensajes; no muestra trazas.

### 9.3 Servicio de escaneo QR (puerto/adaptador)

```ts
export interface QrScannerPort {
  start(video: HTMLVideoElement): Promise<void>;
  stop(): Promise<void>;
  results$: Observable<string>;
}
```

- Adaptador inicial: `@zxing/browser` cargado de forma diferida.
- Se puede sustituir por otra librería sin cambiar la lógica de inventario.
- Verificar licencia, mantenimiento y compatibilidad al instalar.
- Cámara: HTTPS/localhost; estados `idle`, `requesting`, `scanning`, `denied`, `unavailable`, `error`.
- Lector USB: campo de texto con autofocus, `autocomplete="off"`, Enter, debounce y limpieza.
- Entrada manual siempre disponible.
- Pausa de escaneo tras una lectura; botón “Escanear otro”.

### 9.4 Etiqueta QR

- Contenido: `asset_code` o URL estable aprobada (D-05).
- La etiqueta muestra el código legible y, opcionalmente, el nombre del tipo.
- No incluye ubicación, fechas, responsables ni PII.
- Impresión HTML/CSS con tamaño configurable; PDF en fase 2.
- Verificar legibilidad y contraste.

---

## 10. OpenAPI y contrato

- Generar Swagger en NestJS con `@nestjs/swagger`.
- Versionar `docs/api/openapi.yaml` cuando el contrato sea estable (fase 2/3).
- Pruebas de contrato: validar respuestas contra el esquema; detectar campos faltantes o cambios incompatibles.
- Cambios incompatibles requieren nueva versión (`/api/v2`) o ventana de transición.
- Documentar ejemplos de error y idempotencia.

---

## 11. Variables de entorno (nombres, sin secretos)

```text
NODE_ENV=development
PORT=3000
DATABASE_URL=mysql://user:password@localhost:3306/site_dev
JWT_ACCESS_SECRET=<valor-local>
JWT_REFRESH_SECRET=<valor-local>
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d
APP_TIMEZONE=America/Lima
CORS_ORIGINS=http://localhost:4200
QR_BASE_URL=
ASSET_CODE_PREFIX=EXT-
LOG_LEVEL=info
RATE_LIMIT_LOGIN=5
```

Se publica `.env.example` con valores ficticios; `.env` va en `.gitignore`. Nunca se incluyen secretos en el frontend.

---

## 12. Criterios de aceptación de la API

- Todos los endpoints protegidos devuelven 401 sin token y 403 sin permiso.
- Los DTOs rechazan campos desconocidos y valores inválidos.
- Un movimiento con origen incorrecto devuelve 409 y no altera datos.
- Un reintento idempotente no crea una segunda fila.
- Dos movimientos concurrentes no duplican secuencia ni dejan estado inconsistente.
- Las listas son paginadas y filtradas en servidor.
- Los errores tienen código estable y `requestId`.
- OpenAPI refleja los endpoints y esquemas implementados.
- No se exponen secretos, SQL ni trazas internas.
