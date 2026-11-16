# Modelo de datos inicial

Este es un modelo lógico de partida. Debe revisarse antes de generar la migración definitiva. Las tablas/campos exactos pueden cambiar después de validar reglas y roles.

## Entidades principales

| Entidad | Campos principales | Propósito |
|---|---|---|
| `users` | id, name, email, password_hash, active, created_at | Usuarios del sistema; autenticación local con proveedor desacoplado (D-06). |
| `roles` | id, code, name | Roles funcionales. |
| `user_roles` | user_id, role_id | Relación usuario-rol. |
| `locations` | id, code, name, type, parent_id, active | Sedes, almacenes, taller y áreas; jerarquía de dos niveles (D-02). |
| `extinguisher_types` | id, name, agent, capacity_unit, useful_life_years, description | Tipos/clases configurables; vida útil opcional por tipo (D-12). |
| `extinguishers` | id, asset_code, serial_number, type_id, brand, model, capacity, manufacture_date, acquired_at, commissioned_at, manufacturer_expiry_date, logistics_status, technical_condition, current_location_id, active | Ficha individual del equipo. |
| `external_parties` | id, name, party_type, contact, active | Proveedores/talleres/contrapartes externas. |
| `movements` | id, extinguisher_id, movement_type, origin_location_id, destination_location_id, external_party_id, moved_at, requested_by, authorized_by, delivered_by, received_by, reason, document_ref, notes, created_by, created_at | Historial inmutable de movimientos; responsables como snapshot de nombre y sin flujo de aprobación (D-08b). |
| `inspections` | id, extinguisher_id, inspected_at, inspector_id, result, checklist_data, next_due_date, notes, created_by | Inspecciones y su evidencia. |
| `maintenance_records` | id, extinguisher_id, service_type, performed_at, provider_id, certificate_no, result, next_due_date, cost, notes, created_by | Mantenimiento, recarga, reparación y prueba. |
| `alert_settings` | id, event_type, days_before, enabled, scope | Parámetros de alertas configurables. |
| `alerts` | id, extinguisher_id, event_type, target_date, alert_status, generated_at, resolved_at | Reservada para fase 2; no se usa en el MVP: las alertas se calculan desde `due_dates` (D-11). |
| `audit_logs` | id, user_id, entity, entity_id, action, before_data, after_data, created_at | Auditoría de acciones sensibles. |
| `devices` | id, code, label, assigned_user_id, last_sync_at, active | Dispositivos que pueden operar sin conexión; ventana de 7 días y control de sincronización (D-14). |

## Relaciones
- Un tipo de extintor tiene muchos extintores.
- Una ubicación puede tener ubicaciones hijas y muchos extintores asignados.
- Un extintor tiene muchos movimientos, inspecciones, servicios y alertas.
- Un movimiento pertenece a un extintor y referencia origen/destino cuando sea interno; si el destino es externo, referencia `external_party`.
- Un proveedor puede ejecutar muchos servicios.
- Un usuario puede registrar muchos movimientos, inspecciones y servicios.

## Restricciones recomendadas
- `asset_code` único e inmutable.
- `serial_number` nullable; aplicar unicidad solo después de confirmar la política sobre duplicados.
- Índices para `asset_code`, `serial_number`, `current_location_id`, estado logístico, condición técnica y fechas objetivo.
- Claves foráneas y restricciones de integridad.
- No usar borrado en cascada para historial de movimientos o servicios.
- Si un extintor se da de baja, conservar su ficha y su historial.
- No modelar tabla de adjuntos en el MVP: la evidencia es `document_ref` textual (D-13).
- No modelar tablas de notificaciones, suscripciones ni colas de envío en el MVP: las alertas son consultas calculadas y no salen de la aplicación (D-20).
- No modelar tablas de archivo histórico ni jobs de purga: la retención es indefinida en el MVP (D-21).
- No modelar una tabla de borradores offline en el servidor: los borradores viven cifrados en el dispositivo y solo se persisten al confirmarse, con `client_uuid`, `capture_mode`, `device_id` y `synced_at` (D-14).
- No modelar cabecera de lote ni tabla de ítems de lote: la selección múltiple de la interfaz genera un movimiento por activo (D-25).
- Mantener `cost` y `currency` opcionales en el servicio y no modelar tablas de gasto, centros de costo ni conciliación contable: el MVP no genera reportes financieros (D-29).

## Nota de diseño importante
La ubicación actual puede guardarse en `extinguishers.current_location_id` para consultas rápidas, pero esa columna es una proyección del último movimiento confirmado. Solo el servicio de movimientos puede modificarla y debe hacerlo dentro de la misma transacción que inserta el movimiento. Para destinos externos, usa un campo/relación explícito que permita identificar la contraparte y estado externo; no simules que el activo está en un almacén interno.

## Mejora posible
Si se necesita agrupar muchos extintores en una misma orden de traslado, modelar `movement_batches` (cabecera) y `movement_items` (detalle). Para el MVP, un movimiento por activo es más sencillo y reduce errores de trazabilidad.
