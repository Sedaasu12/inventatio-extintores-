# Requerimientos detallados — SITE

> **Estado:** propuesta para revisión. Este documento amplía `docs/01-requerimientos.md`; no lo reemplaza. Los IDs `RF-*` originales se mantienen como referencia y se mapean al final.
>
> **Prioridad:** Must = MVP obligatorio; Should = MVP deseable o segunda fase temprana; Could = segunda fase/opcional.
>
> **Criterio de aceptación:** cada requisito debe poder verificarse con una prueba automatizada, una revisión de API o una prueba E2E. “Implementado” no significa “aprobado” hasta ejecutar y reportar la prueba.

---

## 1. Actores y permisos de alto nivel

| Actor | Código | Alcance |
|---|---|---|
| Administrador | `ADMIN` | Configuración, usuarios, roles, catálogos, ubicaciones, auditoría y ajustes excepcionales. |
| Encargado de almacén | `ALMACEN` | Alta, ingreso, salida, traslado, retorno y envío a mantenimiento. |
| Responsable de seguridad | `SEGURIDAD` | Inspecciones, servicios, condición técnica, alertas y autorización de bajas. |
| Consulta/auditor | `CONSULTA` | Lectura de fichas, historial, alertas y reportes. |

La matriz detallada está en `docs/diseno-api.md`. Los permisos se validan siempre en backend.

---

## 2. Requisitos funcionales

### 2.1 Autenticación, usuarios y seguridad de acceso

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-AUT-01 | Iniciar sesión con correo y contraseña. | Must | Credenciales válidas devuelven token de acceso y perfil; inválidas devuelven 401 sin revelar si el correo existe. |
| RF-AUT-02 | Mantener sesión con refresh token rotativo y cerrar sesión. | Must | El refresh renueva el acceso; el logout revoca el refresh; un refresh revocado devuelve 401. |
| RF-AUT-03 | Cambiar contraseña propia. | Must | Se exige contraseña actual; la nueva tiene 12–128 caracteres y no es común (D-06b); el hash se actualiza y las sesiones previas se revocan según política. |
| RF-AUT-04 | Administrar usuarios y asignar roles. | Must | Solo `ADMIN`; un usuario desactivado no puede iniciar sesión; no se borra físicamente. |
| RF-AUT-05 | Administrar roles y permisos. | Must | Los permisos efectivos se calculan en servidor; cambios quedan auditados. |
| RF-AUT-06 | Aplicar autorización por permiso en cada endpoint. | Must | Un usuario sin permiso recibe 403 aunque invoque la API directamente. |
| RF-AUT-07 | Limitar intentos de login y resolución de códigos. | Must | Superado el límite se devuelve 429 con `Retry-After`; no se bloquea permanentemente una cuenta por defecto. |
| RF-AUT-08 | Registrar eventos de autenticación relevantes. | Must | Login exitoso/fallido, logout y cambio de contraseña quedan en auditoría sin guardar contraseñas ni tokens. |
| RF-AUT-09 | Resolver la identidad mediante un proveedor de autenticación desacoplado. | Should | El MVP usa un proveedor local; sustituirlo no altera sesión, permisos ni auditoría (D-06). |

### 2.2 Ubicaciones y catálogos

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-UBI-01 | Administrar ubicaciones con código único y jerarquía de dos niveles. | Must | Se pueden crear sedes y, dentro de ellas, almacenes, taller y áreas; el código lo genera el servidor y no se repite (D-02). |
| RF-UBI-02 | Consultar el árbol de ubicaciones y sus hijos. | Must | La API devuelve la jerarquía paginada o en árbol; no se expone SQL ni errores internos. |
| RF-UBI-03 | Validar que no se creen ciclos en la jerarquía. | Must | Intentar asignar un descendiente como padre devuelve 422 y no modifica datos. |
| RF-UBI-04 | Desactivar ubicaciones sin borrar historial. | Must | Una ubicación referenciada no se elimina; se desactiva y no puede recibir nuevos movimientos. |
| RF-UBI-05 | Administrar tipos de extintor configurables. | Must | Tipo con agente, capacidad nominal y unidad; no incluye periodos reglamentarios inventados. |
| RF-UBI-06 | Administrar contrapartes externas (proveedores/talleres). | Must | Código único, tipo, contacto y estado activo; una contraparte inactiva no puede recibir envíos. |
| RF-UBI-07 | Administrar tipos de servicio y usar un enum documentado de condiciones técnicas. | Must | La condición es el enum fijo de D-26; los tipos de servicio se configuran como catálogo. |

### 2.3 Ficha individual y código

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-EXT-01 | Crear un extintor como activo individual. | Must | Cada alta genera una ficha con ID interno y `asset_code` únicos. |
| RF-EXT-02 | Generar `asset_code` único, con formato estable e inmutable. | Must | El código no se puede editar después del alta; dos altas concurrentes no producen el mismo código. |
| RF-EXT-03 | Registrar datos técnicos y fechas documentadas. | Must | Tipo, marca, modelo, serie opcional, capacidad, fechas de fabricación/adquisición/puesta en servicio/vencimiento documentado por el fabricante. |
| RF-EXT-04 | Validar coherencia básica de fechas. | Must | Fechas imposibles se rechazan o requieren confirmación autorizada según la regla; la fecha calculada no se persiste como fecha documentada. |
| RF-EXT-05 | Consultar ficha con ubicación, estado, condición y alertas resumidas. | Must | La ficha muestra la colocación actual y no permite editarla directamente. |
| RF-EXT-06 | Buscar y filtrar por código, serie, tipo, ubicación, estado, condición y fechas. | Must | Filtros y paginación se ejecutan en servidor; resultados consistentes. |
| RF-EXT-07 | Editar campos descriptivos y técnicos sin afectar ubicación/estado. | Must | Un payload con `currentLocationId` o `logisticsStatus` es rechazado o ignorado explícitamente; el cambio queda auditado. |
| RF-EXT-08 | Cambiar la condición técnica mediante acción auditada. | Must | Se exige motivo; solo `SEGURIDAD` y `ADMIN` (D-27); no cambia la ubicación. |
| RF-EXT-09 | Generar la etiqueta QR del activo. | Must | El QR contiene solo el código estable o una URL estable aprobada; la etiqueta muestra el código legible. |
| RF-EXT-09A | Impedir que un extintor `NO_OPERATIVO` se asigne a un área. | Must | El alta y el movimiento a área devuelven 422; almacén, taller y proveedor están permitidos (D-26b). |
| RF-EXT-10 | Resolver un código escaneado a la ficha autenticada. | Must | Código existente devuelve ficha; inexistente devuelve 404; dado de baja devuelve ficha con estado y sin acciones ordinarias. |
| RF-EXT-11 | Configurar la vida útil por tipo de extintor y calcular el vencimiento del equipo. | Must | `usefulLifeYears` opcional por tipo; calculada = fabricación + años; sin datos no se inventa fecha (D-12). |
| RF-EXT-12 | Usar la fecha más temprana para la categoría `EQUIPO`. | Must | Se compara la documentada y la calculada; la ficha muestra ambas por separado (D-12). |
| RF-EXT-11 | Imprimir etiquetas sin datos sensibles. | Must | La etiqueta no incluye ubicación, fechas, nombres ni datos personales. |
| RF-EXT-12 | Importar inventario existente de forma controlada. | Should | Proceso validado, idempotente, con reporte de errores; no crea duplicados ni reutiliza códigos. |

### 2.4 Movimientos y trazabilidad

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-MOV-01 | Registrar ingreso inicial con el alta. | Must | El alta crea ficha, movimiento `INGRESO` y estado/colocación en una sola transacción. |
| RF-MOV-02 | Registrar salida de almacén a ubicación interna. | Must | El activo queda `ASIGNADO` en destino y conserva el movimiento. |
| RF-MOV-03 | Registrar traslado entre ubicaciones internas. | Must | Origen = colocación actual; destino activo; estado coherente. |
| RF-MOV-04 | Registrar retorno al almacén. | Must | Activo `ASIGNADO` pasa a `EN_ALMACEN`; se conserva historial. |
| RF-MOV-05 | Registrar envío a mantenimiento externo. | Must | Crea orden, movimiento, colocación externa y estado `EN_MANTENIMIENTO`. |
| RF-MOV-06 | Registrar retorno de mantenimiento. | Must | Exige orden abierta y servicio; cierra orden, actualiza colocación/estado y fechas objetivo. |
| RF-MOV-07 | Registrar baja. | Must | Estado `DADO_DE_BAJA`, colocación `NONE`, historial conservado, no se permiten movimientos ordinarios posteriores; se ejecuta directamente con permiso, `authorized_by` y documento, sin segunda aprobación (D-08b). |
| RF-MOV-08 | Registrar ajuste excepcional. | Must | Solo `ADMIN`; exige motivo, autorización y referencia; se ejecuta directamente sin segunda aprobación; no edita ni borra el movimiento original (D-08b). |
| RF-MOV-09 | Validar que el origen coincida con la colocación actual. | Must | Origen distinto devuelve 409 `ORIGIN_MISMATCH` y no cambia nada. |
| RF-MOV-10 | Ejecutar movimiento y actualización de estado/colocación en una transacción. | Must | Si falla cualquier paso, no queda movimiento ni cambio de estado parcial. |
| RF-MOV-11 | Mantener historial inmutable y ordenado. | Must | No hay endpoints de edición/borrado; secuencia por activo única; línea de tiempo ordenada. |
| RF-MOV-12 | Registrar fecha/hora, responsables, motivo y usuario registrador. | Must | Campos obligatorios por tipo; `created_by` y sello del servidor siempre presentes. |
| RF-MOV-13 | Evitar movimientos duplicados por reintento o doble clic. | Must | La misma clave de idempotencia devuelve el resultado previo; no crea otra fila. |
| RF-MOV-14 | Resolver conflictos de concurrencia. | Must | Dos movimientos simultáneos: uno se confirma, el otro devuelve 409 y no corrompe el estado. |
| RF-MOV-15 | Consultar historial por activo y movimientos globales filtrados. | Must | Paginación, filtros por tipo/fecha/usuario/ubicación y orden descendente/ascendente. |
| RF-MOV-16 | Adjuntar referencia documental al movimiento. | Should | Campo `document_ref` textual obligatorio para mantenimiento externo, baja y ajuste; sin archivos, fotos ni firmas en el MVP (D-13). |
| RF-MOV-17 | Ejecutar operaciones sensibles sin segunda aprobación en la aplicación. | Must | `BAJA` y `AJUSTE` se confirman con permiso, motivo y documento; no existen estados pendientes ni aprobación de otro usuario en el MVP (D-08b). |
| RF-MOV-18 | Mantener la evidencia documental como texto en el MVP. | Must | No se aceptan archivos ni firmas; `document_ref` máximo 100 caracteres; los adjuntos quedan para fase posterior (D-13). |
| RF-MOV-19 | Registrar varios movimientos desde una selección múltiple. | Must | La interfaz selecciona varios activos y confirma una vez; el servidor crea un movimiento individual por activo, sin cabecera de lote; el resultado se informa por equipo (D-25). |

### 2.5 Mantenimiento, recarga, reparación y prueba

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-MAN-01 | Crear orden de mantenimiento externo con proveedor y retorno previsto. | Must | Una sola orden activa por extintor; proveedor activo; fecha de retorno prevista opcional. |
| RF-MAN-02 | Registrar uno o varios servicios por orden. | Must | Tipo, fecha, resultado, certificado/documento, próxima fecha indicada y observaciones. |
| RF-MAN-03 | Registrar servicios internos sin orden externa. | Should | Se puede registrar un servicio realizado por personal interno; actualiza fechas objetivo y auditoría. |
| RF-MAN-04 | Exigir al menos un servicio para cerrar el retorno. | Must | Retorno sin servicio devuelve 422 y no cambia estado. |
| RF-MAN-05 | Registrar el resultado del servicio como evidencia; actualizar la condición técnica solo con una acción explícita y auditada. | Must | El retorno no altera la condición; el cambio exige permiso y motivo (D-10). |
| RF-MAN-06 | Actualizar fechas objetivo de mantenimiento, recarga y prueba. | Must | Solo desde `next_due_date` indicado; si no se indica, la categoría queda sin configurar. |
| RF-MAN-07 | Consultar órdenes abiertas y retornos pendientes. | Must | Listado filtrable por proveedor, estado y fecha prevista; no se confunde con alertas técnicas. |
| RF-MAN-08 | Impedir una segunda orden activa para el mismo activo. | Must | Restricción en base de datos y validación de servicio; 409 al intentar duplicar. |
| RF-MAN-09 | Conservar orden, servicios y movimientos aunque se corrija un error. | Must | Corrección mediante nuevo registro/ajuste; no borrado físico. |
| RF-MAN-10 | Registrar costo y moneda del servicio de forma opcional. | Should | `cost` ≥ 0 y `currency` ISO 4217 cuando se informan; si no hay costo, moneda nula; sin reporte financiero en el MVP (D-29). |

### 2.6 Inspecciones

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-INS-01 | Registrar inspección con fecha, inspector, resultado y checklist. | Must | Inspección queda asociada al activo y al usuario creador. |
| RF-INS-02 | Registrar próxima fecha indicada. | Must | Si se indica, actualiza la fecha objetivo de inspección; si no, queda `SIN_FECHA_CONFIGURADA`. |
| RF-INS-03 | Validar que la próxima fecha sea posterior a la inspección. | Must | Fecha inválida devuelve 422. |
| RF-INS-04 | Consultar historial de inspecciones por activo. | Must | Orden cronológico, paginado, con resultado y documento. |
| RF-INS-05 | No modificar automáticamente la condición técnica. | Must | El MVP no cambia condición por inspección (D-28); se requiere acción separada auditada. |
| RF-INS-06 | Permitir corrección de una inspección sin borrar la anterior. | Should | Nuevo registro correctivo con referencia; historial conservado. |
| RF-INS-07 | Registrar documento/certificado de inspección. | Should | Referencia textual en MVP; archivo en segunda fase. |
| RF-INS-08 | Filtrar inspecciones por fecha, resultado, inspector y ubicación. | Must | Filtros en servidor. |

### 2.7 Fechas objetivo y alertas

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-ALE-01 | Mantener categorías separadas: equipo, inspección, mantenimiento, recarga y prueba hidrostática. | Must | Cada categoría tiene su propia fecha y fuente; `EQUIPO` combina documentada y calculada, y no existe un único campo `fecha_vencimiento` (D-12). |
| RF-ALE-02 | Calcular estado `VENCIDO`, `POR_VENCER`, `VIGENTE` o `SIN_FECHA_CONFIGURADA`. | Must | El cálculo usa la fecha objetivo (para `EQUIPO`, la más temprana disponible), la fecha actual y el umbral configurado; sin umbral no se genera `POR_VENCER` (D-11). |
| RF-ALE-03 | Configurar umbrales por categoría. | Must | `days_before` configurable; sin valor por defecto ni seed (D-11); cambios auditados. |
| RF-ALE-03A | No calcular intervalos de próxima fecha. | Must | La próxima fecha solo se registra desde el certificado/proveedor/responsable; si no se indica, queda sin configurar (D-11). |
| RF-ALE-04 | Mostrar la fecha fuente y los días restantes/atraso. | Must | Cada alerta indica categoría, fecha, días y activo. |
| RF-ALE-05 | Excluir activos dados de baja por defecto. | Must | No aparecen en alertas operativas; se pueden incluir con filtro explícito. |
| RF-ALE-06 | No duplicar alertas al recalcular. | Must | Cálculo determinista desde fechas objetivo; no se insertan filas duplicadas. |
| RF-ALE-07 | Mostrar resumen por categoría y estado. | Must | Dashboard y endpoint de resumen con conteos consistentes. |
| RF-ALE-08 | Soportar activos sin fecha documentada. | Must | Se muestran como `SIN_FECHA_CONFIGURADA`; no se inventa una fecha. |
| RF-ALE-09 | Alertar retornos de mantenimiento pendientes. | Should | Segunda fase o reporte separado; no mezclar con vencimiento técnico. |
| RF-ALE-10 | Mostrar todas las alertas dentro de la aplicación. | Must | Dashboard, ficha y reportes; cualquier usuario con `alerts.read`; sin suscripciones ni envío externo (D-20). |
| RF-ALE-11 | Enviar notificaciones por correo, WhatsApp o SMS. | Could | Fase 2; requiere proveedor, destinatarios, frecuencia y una nueva decisión (D-20). |

### 2.8 Dashboard y reportes

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-DASH-01 | Mostrar total de activos operativos y por estado logístico. | Must | Conteos coinciden con filtros y excluyen bajas por defecto. |
| RF-DASH-02 | Mostrar activos por sede/almacén/área. | Must | Agrupación jerárquica o por ubicación seleccionada. |
| RF-DASH-03 | Mostrar equipos en mantenimiento y retornos pendientes. | Must | Listado con proveedor y fecha prevista. |
| RF-DASH-04 | Mostrar alertas por categoría y estado. | Must | Enlaces al listado filtrado. |
| RF-DASH-05 | Mostrar movimientos recientes. | Should | Últimos movimientos con activo, tipo, origen/destino y usuario. |
| RF-REP-01 | Reporte de inventario por ubicación/estado/condición. | Must | Consulta en pantalla y exportación CSV; PDF/Excel en fase 2 (D-19). |
| RF-REP-02 | Reporte de movimientos por periodo/tipo/usuario/ubicación. | Must | Filtros y paginación; totales consistentes; exportación CSV (D-19). |
| RF-REP-03 | Reporte de inspecciones y servicios próximos/vencidos. | Must | Separado por categoría; exportación CSV (D-19). |
| RF-REP-04 | Reporte de bajas y ajustes con motivo. | Must | Incluye autorización y usuario registrador; exportación CSV (D-19). |
| RF-REP-05 | Exportar a PDF/Excel con formato oficial. | Could | Fase 2; no bloquea el MVP (D-19). |
| RF-REP-06 | Exportar cualquier reporte a CSV con permiso. | Must | `reports.export`; mismos filtros de servidor; sin archivos persistidos (D-19). |

### 2.9 Auditoría

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-AUD-01 | Registrar auditoría de acciones sensibles. | Must | Alta/edición de activo, movimientos, inspecciones, servicios, permisos, umbrales y bajas. |
| RF-AUD-02 | Guardar antes/después cuando aplique. | Must | JSON de cambios sin contraseñas, tokens ni datos sensibles innecesarios. |
| RF-AUD-03 | Asociar usuario, fecha, entidad e ID. | Must | Campos obligatorios; acciones de sistema con usuario nulo identificable. |
| RF-AUD-04 | No permitir edición ni borrado de auditoría. | Must | No hay endpoints de escritura/borrado; restricciones de base de datos. |
| RF-AUD-05 | Consultar auditoría con filtros y permisos. | Must | Solo `ADMIN`/`CONSULTA` autorizado; paginación. |

### 2.10 QR y captura

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-QR-01 | Escanear QR con cámara del navegador. | Must | Con permiso concedido, detecta y resuelve el código; con permiso denegado, muestra fallback. |
| RF-QR-02 | Soportar lector USB 2D en modo teclado. | Must | El código escrito en el campo enfocado + Enter resuelve la ficha. |
| RF-QR-03 | Permitir entrada manual del código. | Must | Búsqueda manual funciona aunque no haya cámara ni lector. |
| RF-QR-04 | Evitar lecturas/confirmaciones duplicadas. | Must | Pausa de escaneo y bloqueo de envío; idempotencia en backend. |
| RF-QR-05 | Informar códigos inexistentes o ilegibles. | Must | Mensaje claro; no se crea un activo automáticamente. |
| RF-QR-06 | No incluir datos sensibles en el QR. | Must | Solo código estable o URL estable; sin ubicación, fechas, nombres ni PII. |

### 2.11 Operación sin conexión

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-OFF-01 | Consultar información descargada sin conexión. | Must | Fichas, ubicaciones y catálogos del alcance asignado se leen desde caché cifrada (D-14). |
| RF-OFF-02 | Preparar borradores de movimientos rutinarios e inspecciones sin conexión. | Must | Se guardan localmente; la UI indica claramente que **no** están confirmados (D-14). |
| RF-OFF-03 | Sincronizar borradores al recuperar la conexión. | Must | Envío por lote; resultado por ítem: confirmado, rechazado o duplicado (D-14). |
| RF-OFF-04 | Confirmar en el servidor con validación de origen y permisos. | Must | Un borrador inválido se rechaza completo y se marca como conflicto; sin cambios parciales (D-14). |
| RF-OFF-05 | Evitar duplicados al reintentar. | Must | `clientUuid` idempotente; reenvío devuelve el resultado original (D-14). |
| RF-OFF-06 | Bloquear operaciones sensibles sin conexión. | Must | `BAJA`, `AJUSTE`, cambio de condición y administración exigen conexión (D-14). |
| RF-OFF-07 | Limitar la ventana sin sincronizar. | Must | Máximo 7 días; después se bloquean escrituras hasta reconectar, sin impedir la lectura (D-14). |
| RF-OFF-08 | Registrar dispositivo y tiempos. | Must | `deviceId`, hora del hecho declarada por el dispositivo y `syncedAt`; auditoría conserva ambos (D-14). |

---

## 3. Requisitos no funcionales

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RNF-01 | Seguridad de autenticación y autorización en servidor. | Must | Hash de contraseña con Argon2id o bcrypt costo ≥12; RBAC; sin secretos en frontend. |
| RNF-02 | Integridad transaccional. | Must | Movimiento + proyección + auditoría en una transacción; pruebas de fallo. |
| RNF-03 | Trazabilidad e inmutabilidad del historial. | Must | Sin borrado físico de movimientos, inspecciones o servicios confirmados. |
| RNF-04 | Usabilidad responsive. | Must | Funciona en escritorio, tablet y móvil; formularios utilizables a 360 px. |
| RNF-05 | Accesibilidad. | Must | Objetivo WCAG 2.1 AA: foco visible, etiquetas, contraste, navegación por teclado. |
| RNF-06 | Rendimiento. | Must | Listados paginados; p95 < 500 ms para consultas típicas con 10 000 activos; dashboard < 1 s. |
| RNF-07 | Disponibilidad y manejo de errores. | Must | Errores de red/cámara/lector tienen mensaje y reintento; no se simula éxito. |
| RNF-08 | Mantenibilidad. | Must | Módulos separados, migraciones versionadas, lint/typecheck/build en CI. |
| RNF-09 | Respaldo y restauración. | Must | Procedimiento documentado y probado; backup diario cifrado; RPO 24 h / RTO 4 h (D-23). |
| RNF-10 | Privacidad y minimización. | Must | QR sin PII; nombres de responsables con acceso restringido; no exponer datos en logs. |
| RNF-11 | Compatibilidad. | Must | Chrome/Edge/Safari actuales; cámara requiere HTTPS o localhost. |
| RNF-12 | Observabilidad. | Should | Logs estructurados con request ID; health checks; sin datos sensibles. |
| RNF-13 | Internacionalización. | Could | Español en MVP; fechas/números localizados; arquitectura preparada para i18n. |
| RNF-14 | Portabilidad de despliegue. | Should | Variables de entorno; Docker opcional; instalación local de MySQL documentada. |
| RNF-15 | Calidad de pruebas. | Must | Unitarias de reglas, integración de transacciones y E2E de flujos principales ejecutadas. |
| RNF-16 | Operación sin conexión. | Must | PWA con caché de lectura y borradores cifrados; sincronización idempotente y conflictos explícitos (D-14). |

---

## 4. Requisitos de datos y retención

| ID | Requisito | Prioridad | Criterio de aceptación |
|---|---|---|---|
| RF-DAT-01 | Código de activo único, inmutable y no reutilizable. | Must | Restricción única; sin endpoint de cambio; no se reutiliza tras baja. |
| RF-DAT-02 | Ubicación actual reconstruible desde movimientos. | Must | La proyección se actualiza solo por el servicio de movimientos; prueba de consistencia. |
| RF-DAT-03 | Fechas separadas por categoría. | Must | Tabla de fechas objetivo con `event_type` único por activo. |
| RF-DAT-04 | Contraparte externa explícita. | Must | No se simula un proveedor como almacén interno. |
| RF-DAT-05 | Historial inmutable. | Must | `onDelete: Restrict`; sin endpoints de borrado; auditoría de correcciones. |
| RF-DAT-06 | Datos de catálogo desactivables. | Must | No se borran si están referenciados; se marcan inactivos. |
| RF-DAT-07 | Retención de historial y auditoría. | Should | Conservación indefinida en el MVP; sin purga, archivo ni anonimización (D-21). |
| RF-DAT-08 | Importación reproducible. | Should | Script/seed identificado como datos de desarrollo; importación real separada y auditada. |

---

## 5. Trazabilidad con los requerimientos originales

| Original | Requisitos detallados |
|---|---|
| RF-01, RF-02 | RF-AUT-01..08 |
| RF-03 | RF-EXT-01..07 |
| RF-04 | RF-EXT-02, RF-EXT-09, RF-QR-01..06 |
| RF-05 | RF-UBI-01..04 |
| RF-06 | RF-MOV-01 |
| RF-07 | RF-MOV-02 |
| RF-08 | RF-MOV-03, RF-MOV-04, RF-MOV-19 |
| RF-09 | RF-MOV-05, RF-MOV-06, RF-MAN-01..09 |
| RF-10 | RF-EXT-05, RF-MOV-09 |
| RF-11 | RF-MOV-11, RF-MOV-15 |
| RF-12 | RF-INS-01..08 |
| RF-13 | RF-MAN-02..06, RF-MAN-10 |
| RF-14 | RF-MAN-02, RF-INS-07 |
| RF-15 | RF-ALE-01..10 |
| RF-16 | RF-DASH-01..05 |
| RF-17 | RF-EXT-06, RF-MOV-15 |
| RF-18 | RF-REP-01..04, RF-REP-06 |
| RF-19 | RF-REP-05 |
| RF-20 | RF-AUD-01..05 |
| RF-21 | RF-QR-01 |
| RF-22 | RF-QR-02, RF-QR-03 |
| RF-23 | RF-MOV-07 |
| RF-24 | RF-MOV-16, RF-MAN-02, RF-INS-07 (archivos en segunda fase) |
| RF-25 | RF-OFF-01..08 |

---

## 6. Fuera de alcance explícito

- Cálculo de niveles de riesgo, cobertura o dotación mínima de extintores.
- Determinación de intervalos reglamentarios sin documento o responsable autorizado.
- Firma electrónica con validez legal.
- Facturación, compras o contabilidad.
- App nativa; la operación sin conexión se cubre con PWA y borradores (D-14), no con una aplicación instalable.
- Notificaciones por WhatsApp/SMS.
- Multi-tenant y aislamiento entre organizaciones.
- Integración con sistemas de bomberos, ERP o IoT.

Cualquier incorporación de estos puntos requiere análisis de alcance, seguridad y pruebas adicionales.

---

## 7. Definición de “requisito cumplido”

Un requisito se considera cumplido solo si:

1. Está implementado en backend y, cuando corresponde, en frontend.
2. Tiene validación de servidor y manejo de errores.
3. Tiene al menos una prueba automatizada del camino feliz y una del rechazo por regla.
4. La prueba se ejecutó y su resultado real se reportó.
5. La documentación de API y operación está actualizada.
6. No introduce datos inventados, secretos ni cambios silenciosos de ubicación.
