# Análisis funcional — Sistema de Inventario y Trazabilidad de Extintores (SITE)

> **Estado:** propuesta para revisión y aprobación. No implementa código de producción.
>
> **Documentos fuente:** `AGENTS.md`, `docs/00-vision-y-alcance.md`, `docs/01-requerimientos.md`, `docs/02-arquitectura.md`, `docs/03-modelo-de-datos.md`, `docs/04-flujos-y-pruebas.md` y las skills `extintores-dominio`, `qr-trazabilidad` y `entrega-calidad`.
>
> **Documentos de esta entrega:** `requerimientos.md`, `reglas-de-negocio.md`, `modelo-entidad-relacion.md`, `diseno-api.md`, `plan-de-pruebas.md`, `decisiones-pendientes.md` y `plan-implementacion.md`.

---

## 1. Resumen ejecutivo

SITE debe responder una pregunta central que una planilla o un inventario por cantidades no responde: **¿dónde está cada extintor, en qué estado está y quién responde por él en este momento, sin perder el rastro de cómo llegó ahí?**

La propuesta separa explícitamente cuatro conceptos que suelen confundirse:

1. **Identidad del activo:** código interno único e inmutable, independiente de la ubicación y del estado.
2. **Ubicación física actual:** ubicación interna jerárquica o contraparte externa (proveedor/taller).
3. **Estado logístico:** en almacén, asignado, en mantenimiento externo o dado de baja.
4. **Condición técnica:** operativo, observado, no operativo o pendiente de inspección.

La ubicación y el estado actuales son una **proyección del último movimiento confirmado**. Solo el servicio de movimientos puede modificarlos, siempre dentro de una transacción y dejando un registro inmutable. Las fechas técnicas se almacenan por categoría independiente y las alertas se calculan con umbrales configurables; el sistema no inventa intervalos reglamentarios.

El repositorio es un **punto de partida documental**, no un proyecto iniciado. La implementación puede comenzar desde cero sin riesgo de sobrescribir código existente, pero requiere cerrar varias decisiones de negocio antes de la primera migración.

---

## 2. Inspección del repositorio

### 2.1 Qué existe

| Elemento | Estado | Observación |
|---|---|---|
| `AGENTS.md` | Existe | Reglas permanentes del proyecto y stack objetivo. |
| `README.md`, `PROMPT_INICIAL.md`, `REFERENCIAS.md` | Existen | Material de arranque y referencias. |
| `docs/00` a `docs/05` | Existen | Visión, requerimientos, arquitectura, modelo inicial, flujos/pruebas y selección de modelos. |
| `.opencode/skills/*` | Existen | Skills de dominio, QR y calidad; fueron cargadas para este análisis. |
| Código de aplicación | **No existe** | No hay `package.json`, `angular.json`, `nest-cli.json`, `src/` ni `frontend/`/`backend/`. |
| Base de datos / migraciones | **No existe** | No hay `schema.prisma`, migraciones, scripts SQL ni contenedores. |
| Pruebas | **No existe** | No hay suites ni configuración de test. |
| Variables de entorno / secretos | **No existe** | No se encontraron `.env` ni claves. Correcto para esta etapa. |
| Control de versiones | **No inicializado** | El entorno indica que la carpeta no es un repositorio Git. |

### 2.2 Qué falta para implementar

- Estructura de monorepo o repositorios separados para `frontend/` y `backend/`.
- Versiones fijadas de Node.js, Angular, NestJS, Prisma y MySQL.
- Esquema Prisma y migración inicial.
- Autenticación, autorización y auditoría.
- API REST y contratos OpenAPI.
- Interfaz Angular y servicio de escaneo QR.
- Pruebas unitarias, de integración, E2E y de migración.
- Configuración de entornos, respaldo y despliegue.

### 2.3 Implicaciones

- **No hay trabajo previo que destruir.** Los documentos existentes se conservan como línea base; los nuevos documentos los detallan y, en algunos puntos, los refinan.
- **Hay que crear el proyecto desde cero.** La primera fase debe incluir control de versiones, versiones fijadas, lint, typecheck, pruebas y build antes de escribir reglas de negocio.
- **Las decisiones de negocio ya resueltas permiten fijar la migración.** El alcance single-tenant (D-01), el vencimiento del equipo (D-12), los umbrales de alerta (D-11), la autorización de movimientos (D-07/D-08b), la evidencia textual (D-13), los formatos de reporte (D-19), el canal de alertas (D-20) y la retención (D-21) están aprobados; quedan decisiones abiertas que no cambian el núcleo del modelo (volumen, despliegue y lotes).

---

## 3. Problema, usuarios y alcance

### 3.1 Problema

Una organización con varias sedes necesita controlar extintores que se compran, se instalan, se trasladan, se envían a mantenimiento y se dan de baja. Un inventario agregado (“hay 40 extintores”) no permite:

- saber qué unidad concreta está en cada área;
- demostrar quién entregó y quién recibió un equipo;
- reconstruir el recorrido de una unidad;
- detectar equipos enviados a mantenimiento que no regresaron;
- separar el vencimiento del equipo de la próxima inspección, recarga o prueba hidrostática;
- evitar que dos personas registren el mismo movimiento o que se modifique la ubicación “a mano” sin historial;
- identificar equipos sin fecha técnica configurada, que no deben generar una fecha inventada.

### 3.2 Usuarios

| Rol propuesto | Código | Necesidad principal |
|---|---|---|
| Administrador | `ADMIN` | Configurar usuarios, roles, catálogos, ubicaciones, parámetros y auditar. |
| Encargado de almacén | `ALMACEN` | Dar de alta, ingresar, entregar, trasladar, devolver al almacén y enviar a mantenimiento. |
| Responsable de seguridad | `SEGURIDAD` | Inspeccionar, registrar servicios, evaluar condición técnica, revisar alertas y autorizar bajas. |
| Consulta / auditor | `CONSULTA` | Leer fichas, historial, alertas y reportes sin modificar datos. |

Los nombres definitivos y la separación exacta de permisos deben confirmarse con el propietario del proceso. El backend siempre valida permisos; la interfaz solo oculta acciones para mejorar la experiencia.

### 3.3 Alcance del MVP

**Incluido:**

- Autenticación local, usuarios, roles y permisos.
- Ubicaciones jerárquicas simples (sede, almacén, taller, área) y contrapartes externas.
- Ficha individual del extintor con código único, datos técnicos y fechas documentadas.
- QR estable por activo, lectura por cámara, lector USB 2D en modo teclado y entrada manual.
- Movimientos: ingreso, salida, traslado, retorno al almacén, envío a mantenimiento, retorno de mantenimiento, baja y ajuste excepcional.
- Historial cronológico inmutable por activo.
- Inspecciones y servicios técnicos (mantenimiento, recarga, reparación, prueba hidrostática).
- Fechas objetivo separadas y alertas calculadas con umbrales configurables.
- Dashboard, búsqueda, filtros, reportes básicos y auditoría.
- Pruebas de reglas críticas, transacciones, concurrencia y flujos E2E principales.

**Segunda fase:**

- Adjuntos, firmas, fotos y actas.
- Exportación PDF/Excel y reportes avanzados.
- Notificaciones por correo.
- Importación masiva de inventario existente.
- Lotes de movimiento para trasladar varios equipos en una sola orden.
- PWA y mejoras de operación móvil.
- Alertas de retornos de mantenimiento pendientes.
- Catálogos administrables de condiciones técnicas y tipos de inspección.

**Fuera de alcance:**

- Diagnóstico técnico automático o certificación normativa.
- Diseño de la instalación de extintores o cálculo de cobertura.
- Compra/venta, facturación o integración contable.
- App móvil nativa.
- Operación offline con sincronización.
- Integración con WhatsApp/SMS o IoT.
- Multi-tenant (varias organizaciones aisladas) en el MVP.

---

## 4. Conceptos y modelo mental

| Concepto | Definición | No confundir con |
|---|---|---|
| **Extintor / activo** | Unidad física individual con ficha propia. | Una cantidad agregada o un tipo de extintor. |
| **`asset_code`** | Código interno legible, único e inmutable (ej. `EXT-000125`). | Número de serie del fabricante, que puede faltar o repetirse por error. |
| **Ubicación** | Nodo de la jerarquía interna: sede, almacén, taller o área. | Estado logístico o condición técnica. |
| **Contraparte externa** | Proveedor, taller u organización que recibe temporalmente el equipo. | Ubicación interna simulada. |
| **Colocación actual** | `INTERNAL` (ubicación interna), `EXTERNAL` (contraparte) o `NONE` (dado de baja). | Texto libre “ubicación” en la ficha. |
| **Estado logístico** | `EN_ALMACEN`, `ASIGNADO`, `EN_MANTENIMIENTO`, `DADO_DE_BAJA`. | Condición técnica. |
| **Condición técnica** | `OPERATIVO`, `OBSERVADO`, `NO_OPERATIVO`, `PENDIENTE_INSPECCION`. | Estado logístico. |
| **Movimiento** | Hecho histórico inmutable que cambia o confirma la colocación/estado. | Edición directa de la ficha. |
| **Orden de mantenimiento** | Ciclo de envío externo y retorno, con proveedor y fechas. | Un simple comentario o un servicio suelto. |
| **Servicio técnico** | Mantenimiento, recarga, reparación o prueba hidrostática realizada. | Inspección periódica. |
| **Inspección** | Verificación periódica con resultado y próxima fecha indicada. | Mantenimiento o recarga. |
| **Fecha objetivo** | Fecha documentada de vencimiento o próxima atención por categoría. | Fecha calculada por el sistema sin fuente. |
| **Alerta** | Clasificación calculada (`VENCIDO`, `POR_VENCER`, `VIGENTE`, `SIN_FECHA_CONFIGURADA`) para una fecha objetivo. | Una fecha almacenada o un intervalo inventado. |

### 4.1 Principio de reconstrucción

La ficha guarda `current_location_id`, `current_external_party_id`, `placement_type`, `logistics_status` y `current_since` para consultas rápidas, pero esos campos son **una proyección**. La fuente de verdad es la secuencia de movimientos confirmados. Si la proyección y el historial discrepan, se detecta y se corrige con un ajuste auditado, nunca editando la ubicación desde un formulario.

---

## 5. Flujos funcionales completos

Cada flujo indica disparador, actor, precondiciones, pasos, validaciones, resultado y excepciones. Los detalles de permisos y endpoints están en `diseno-api.md`; las pruebas, en `plan-de-pruebas.md`.

### 5.1 Alta de extintor e ingreso inicial

**Disparador:** se adquiere un extintor o se incorpora al inventario.

**Actor:** `ADMIN` o `ALMACEN`.

**Precondiciones:** usuario autenticado con permiso `extinguishers.create`; tipo de extintor y ubicación inicial activos.

**Pasos:**

1. El usuario abre “Nuevo extintor” y completa datos técnicos: tipo, marca, modelo, serie si existe, capacidad, fechas documentadas, condición técnica inicial y observaciones.
2. Indica la ubicación inicial (almacén o área interna) o, si el flujo lo permite, una contraparte externa de origen.
3. El backend valida campos, duplicados y coherencia de fechas.
4. En una transacción: genera el `asset_code`, crea la ficha, crea el movimiento `INGRESO` con secuencia 1, fija la colocación/estado inicial, crea las fechas objetivo documentadas y registra auditoría.
5. El sistema devuelve la ficha, el movimiento inicial y el contenido del QR.
6. El usuario imprime la etiqueta con QR y código legible.

**Validaciones críticas:**

- `asset_code` único, formato válido e inmutable.
- Si se permite código manual para migración, no debe existir ni haberse usado antes.
- La fecha de fabricación no puede ser futura; la de adquisición no puede ser anterior a la de fabricación; la puesta en servicio no puede ser anterior a la adquisición, salvo justificación autorizada.
- La fecha de vencimiento documentada del fabricante se registra solo si existe respaldo; la calculada se obtiene de fabricación + vida útil del tipo. La categoría `EQUIPO` usa la más temprana y no se inventa una fecha (D-12).
- La ubicación inicial debe estar activa y ser compatible con el estado inicial.
- Si la ubicación es un almacén, el estado es `EN_ALMACEN`; si es un área interna, `ASIGNADO`. Esta política debe confirmarse (D-03).

**Resultado:** activo individual con historial inicial, QR y estado actual coherente.

**Excepciones:** código duplicado (409), ubicación inactiva (422), datos inválidos (422), fallo de transacción (rollback total, sin ficha ni movimiento parcial).

### 5.2 Salida de almacén

**Disparador:** un extintor sale del almacén hacia un área interna.

**Actor:** `ALMACEN`.

**Precondiciones:** activo en `EN_ALMACEN`, colocado en el almacén de origen; usuario con `movements.create`.

**Pasos:**

1. El usuario escanea el QR o busca el código.
2. El sistema muestra ficha, ubicación actual y condición técnica.
3. El usuario elige “Salida” e indica destino interno, motivo, solicitante, entregado por, recibido por, fecha/hora y documento si aplica.
4. El backend bloquea la fila del activo, verifica que el origen coincida con la ubicación actual, valida el destino y los campos obligatorios.
5. En una transacción inserta el movimiento `SALIDA`, actualiza la colocación a la ubicación destino, cambia el estado a `ASIGNADO`, actualiza `current_since` e incrementa la versión.
6. Devuelve el movimiento y la ficha actualizada.

**Validaciones:** origen exacto; destino activo y no igual al origen; no se permite salir de un activo en mantenimiento o dado de baja; receptor obligatorio; fecha no futura más allá de la tolerancia; secuencia de movimiento única.

**Excepciones:** origen incorrecto (409 `ORIGIN_MISMATCH`), activo dado de baja (409), conflicto de concurrencia (409), permisos insuficientes (403).

### 5.3 Traslado entre ubicaciones internas

**Disparador:** el equipo cambia de área, almacén o taller.

**Actor:** `ALMACEN` o usuario autorizado.

**Pasos:** escanear/buscar; elegir “Traslado”; indicar origen (precargado y no editable), destino, motivo, responsables y receptor; confirmar. El backend valida que el origen sea la colocación actual y que el destino sea una ubicación interna activa. Actualiza estado según el tipo de destino: almacén → `EN_ALMACEN`; área → `ASIGNADO`.

**Regla especial:** si el destino es un almacén y el origen es un área, el flujo recomendado es `RETORNO_ALMACEN`, no `TRASLADO`, para que los reportes distingan una devolución de un traslado operativo. La API puede rechazar la combinación o normalizarla; se documenta como regla.

### 5.4 Retorno al almacén

**Disparador:** un área devuelve un extintor al almacén.

**Actor:** `ALMACEN`.

**Pasos:** escanear; elegir “Retorno a almacén”; indicar almacén destino, motivo, entregado por, recibido por y fecha. El backend valida que el activo esté `ASIGNADO` en un área interna, inserta `RETORNO_ALMACEN` y cambia a `EN_ALMACEN`.

**Excepciones:** si el activo está en mantenimiento externo, debe usarse `RETORNO_MANTENIMIENTO`; si está dado de baja, se rechaza.

### 5.5 Envío a mantenimiento externo

**Disparador:** el extintor requiere mantenimiento, recarga, reparación o prueba hidrostática en un proveedor/taller.

**Actor:** `ALMACEN` o `SEGURIDAD` con `maintenance.manage`.

**Precondiciones:** activo interno (`EN_ALMACEN` o `ASIGNADO`), proveedor activo, sin orden de mantenimiento abierta.

**Pasos:**

1. Escanear/buscar el activo.
2. Elegir “Enviar a mantenimiento”.
3. Indicar proveedor, motivo, fecha de envío, retorno previsto si existe, autorizado por, entregado por, documento/constancia y notas.
4. El backend valida origen, proveedor y ausencia de otra orden activa.
5. En una transacción: crea la orden de mantenimiento, inserta `ENVIO_MANTENIMIENTO`, cambia la colocación a la contraparte externa, estado `EN_MANTENIMIENTO`, y registra auditoría.
6. La condición técnica **no se cambia automáticamente** al enviar; el equipo deja de estar operativo por su estado logístico, no por una suposición técnica.

**Excepciones:** orden activa duplicada (409), proveedor inactivo (422), origen incorrecto (409), documento obligatorio faltante (422).

### 5.6 Retorno de mantenimiento

**Disparador:** el proveedor devuelve el extintor.

**Actor:** `SEGURIDAD` o `ALMACEN` con `maintenance.manage`.

**Precondiciones:** orden abierta/en proveedor; al menos un servicio registrado con resultado; proveedor coincide con el origen externo actual.

**Pasos:**

1. Registrar el/los servicios realizados: tipo, fecha, resultado, certificado/documento, próxima fecha indicada y observaciones.
2. Elegir “Registrar retorno”; indicar ubicación interna destino (almacén o área), recibido por, fecha, motivo, documento y notas.
3. El backend valida que la orden esté abierta, que exista al menos un servicio y que la fecha de retorno no sea anterior al envío/servicio.
4. En una transacción: inserta `RETORNO_MANTENIMIENTO`, actualiza la colocación interna y el estado (`EN_ALMACEN` o `ASIGNADO`), cierra la orden y recalcula las fechas objetivo de mantenimiento/recarga/prueba. **No** cambia la condición técnica: el resultado del servicio es evidencia (D-10).
5. Devuelve la ficha, el historial y las nuevas alertas.

**Condición técnica tras el servicio:** el resultado (`APROBADO`, `APROBADO_CON_OBSERVACIONES`, `RECHAZADO`) queda como evidencia. Si se requiere cambiar la condición, se usa la acción explícita `POST /extinguishers/:id/condition`, con motivo y auditoría (D-10, BR-089).

**Excepciones:** retorno sin servicio (422), orden inexistente/cerrada (409), proveedor distinto (409), fecha inválida (422).

### 5.7 Inspección

**Disparador:** corresponde una inspección periódica o se detecta una novedad.

**Actor:** `SEGURIDAD`.

**Pasos:**

1. Escanear/buscar el activo.
2. Registrar fecha, inspector, resultado, checklist/observaciones, documento y próxima fecha indicada por la política o el responsable autorizado.
3. El backend valida la fecha y actualiza la fecha objetivo de inspección.
4. Si se indica una nueva próxima fecha, reemplaza la anterior; si no se indica, la fecha objetivo queda sin configurar (no se conserva una fecha vieja como si siguiera vigente).
5. La condición técnica **no se modifica automáticamente** por el resultado de la inspección (D-28); si se requiere cambiarla, se usa una acción separada y auditada (D-27).

**Excepciones:** fecha futura, próxima fecha anterior a la inspección, activo dado de baja (se permite consultar historial, no inspeccionar), permisos insuficientes.

### 5.8 Alertas por fechas técnicas

**Disparador:** consulta del dashboard, listado de alertas o proceso programado.

**Actor:** cualquier rol con `alerts.read`; configuración solo `ADMIN` (y eventualmente `SEGURIDAD`).

**Categorías independientes:** `EQUIPO` (vencimiento documentado del fabricante y vida útil calculada por tipo), `INSPECCION`, `MANTENIMIENTO`, `RECARGA`, `PRUEBA_HIDROSTATICA`.

**Cálculo:**

- Sin fecha indicada ni calculable → `SIN_FECHA_CONFIGURADA`.
- Para `EQUIPO`, si existen ambas, se usa la más temprana (D-12).
- `INSPECCION`, `MANTENIMIENTO`, `RECARGA` y `PRUEBA_HIDROSTATICA` usan solo la fecha indicada; no se calculan intervalos (D-11).
- Fecha anterior a hoy → `VENCIDO`.
- Fecha dentro del umbral configurado → `POR_VENCER`.
- Fecha fuera del umbral → `VIGENTE`.

El umbral `days_before` es configurable por categoría y no tiene un valor por defecto inventado. Si no está configurado, no se genera `POR_VENCER`; solo se distingue vencido/vigente. Las alertas se calculan desde la tabla de fechas objetivo, por lo que no se duplican al ejecutar el proceso varias veces.

**Excepciones:** activo dado de baja (se excluye por defecto), fecha objetivo de una fuente corregida (se recalcula), cambio de zona horaria (se calcula con la zona configurada).

### 5.9 Baja

**Disparador:** el extintor se retira definitivamente del inventario operativo.

**Actor:** `ADMIN` o `SEGURIDAD` con `extinguishers.retire` (a confirmar, D-17).

**Precondiciones:** activo interno, no dado de baja, sin orden de mantenimiento abierta (por defecto).

**Pasos:**

1. Escanear/buscar el activo.
2. Elegir “Dar de baja”; indicar motivo, fecha efectiva, autorizado por, documento/acta y notas.
3. El backend valida permisos, estado y ausencia de mantenimiento abierto.
4. En una transacción: inserta `BAJA` con origen actual y destino `NONE`, cambia el estado a `DADO_DE_BAJA`, limpia la colocación actual, registra `retired_at`/motivo y audita.
5. El activo deja de aparecer en inventario operativo y alertas, pero conserva ficha e historial.

**Excepciones:** baja desde mantenimiento (rechazada por defecto), baja duplicada (409), falta de autorización/documento (422), intento de movimiento posterior (409).

**Reactivación:** solo por `AJUSTE` excepcional de `ADMIN`, con motivo y auditoría; no es un flujo ordinario.

### 5.10 Corrección o ajuste

**Disparador:** un movimiento se registró mal, una ubicación quedó inconsistente o se detectó un error de datos.

**Actor:** `ADMIN` con `movements.adjust`.

**Regla:** no se edita ni se borra el movimiento original. Se inserta un movimiento `AJUSTE` que corrige la proyección, referencia el movimiento corregido cuando aplique y explica el motivo.

**Pasos:** seleccionar activo; indicar estado/colocación correctos, movimiento que se corrige, motivo, autorizado por y documento; confirmar. El backend valida que el ajuste sea coherente y deja ambos registros en la línea de tiempo.

### 5.11 Escaneo QR

**Disparador:** el usuario abre “Escanear” o enfoca un campo con un lector USB 2D.

**Actor:** usuario autenticado con permiso de lectura.

**Pasos:**

1. La aplicación solicita permiso de cámara y muestra el visor.
2. Al detectar un código, pausa temporalmente la lectura para evitar duplicados.
3. Resuelve el código contra la API autenticada.
4. Si existe, muestra ficha, ubicación, condición, alertas y acciones permitidas.
5. Si no existe, informa y no crea nada.
6. Para operar, abre el formulario con el activo preseleccionado; el usuario revisa y confirma.

**Fallbacks:** entrada manual; lector USB que escribe el código y Enter; cámara denegada o no disponible. El escaneo no concede acceso ni confirma movimientos por sí solo.

---

## 6. Requisitos y reglas

El detalle completo está en:

- `docs/requerimientos.md`: requisitos funcionales y no funcionales con prioridad y criterios de aceptación.
- `docs/reglas-de-negocio.md`: reglas numeradas, máquinas de estado, validaciones y mecanismos de cumplimiento.
- `docs/modelo-entidad-relacion.md`: entidades, relaciones, restricciones e índices.
- `docs/diseno-api.md`: endpoints, permisos y contratos.
- `docs/plan-de-pruebas.md`: casos y trazabilidad.
- `docs/decisiones-pendientes.md`: decisiones que requieren confirmación.
- `docs/plan-implementacion.md`: fases, dependencias y verificación.

---

## 7. Separación MVP / segunda fase / opcional

| Capacidad | MVP | Segunda fase | Opcional |
|---|---:|---:|---:|
| Autenticación local y RBAC | Sí | | |
| Usuarios, roles, permisos | Sí | | |
| Ubicaciones jerárquicas | Sí | | |
| Ficha individual y código único | Sí | | |
| QR + cámara + lector 2D + manual | Sí | | |
| Ingreso, salida, traslado, retorno | Sí | | |
| Mantenimiento externo y retorno | Sí | | |
| Inspecciones y servicios | Sí | | |
| Fechas separadas y alertas | Sí | | |
| Historial y auditoría | Sí | | |
| Dashboard y reportes básicos | Sí | | |
| Exportación CSV | Sí | | |
| Adjuntos/firmas/fotos | | Sí | |
| Exportación PDF/Excel | | Sí | |
| Correo | | Sí | |
| Importación masiva | | Sí | |
| Lotes de movimiento | | Sí | |
| PWA / offline | | | Sí |
| App nativa | | | Sí |
| Integraciones IoT/ERP | | | Sí |
| Multi-tenant | | | Sí |

---

## 8. Riesgos principales

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Intervalos técnicos no confirmados | Alertas incorrectas o falsa sensación de cumplimiento | No sembrar periodos; configurar umbrales y fechas solo desde documentos/responsable. |
| Datos existentes en planillas | Retraso de adopción y códigos duplicados | Definir estrategia de importación y validación antes de la fase 4. |
| Uso de la ubicación como campo editable | Pérdida de trazabilidad | La API rechaza cambios de ubicación fuera del servicio de movimientos; pruebas de contrato. |
| Doble clic o reintentos de red | Movimientos duplicados | Idempotencia en backend y bloqueo de UI. |
| Concurrencia entre usuarios | Estados inconsistentes | Bloqueo de fila, versión optimista y pruebas concurrentes. |
| Cámara en HTTP o navegador antiguo | Escaneo no disponible | Requerir HTTPS/localhost, fallback manual y lector USB. |
| Zona horaria | Alertas y fechas desfasadas | Guardar UTC, calcular con zona configurada, pruebas de borde. |
| Permisos ambiguos | Operaciones no autorizadas o bloqueos | Matriz de permisos aprobada y pruebas 403. |
| Crecimiento del historial | Consultas lentas | Índices, paginación y filtros en servidor. |
| Pérdida de datos | Incumplimiento y pérdida de trazabilidad | Backups, restauración probada y migraciones versionadas. |
| Etiquetas dañadas | Activo no localizable por QR | Código legible en la etiqueta y búsqueda manual. |
| PII en campos libres | Exposición de datos | Minimización, control de acceso y no incluir PII en QR. |

---

## 9. Supuestos adoptados para continuar

Se registran como supuestos explícitos; no son reglas aprobadas. El detalle y las alternativas están en `decisiones-pendientes.md`.

| ID | Supuesto |
|---|---|
| S-01 | Una sola organización en el MVP, con varias sedes; el almacén central y el taller dependen de una sede (D-02). |
| S-02 | Zona horaria de operación `America/Lima`; eventos en UTC y fechas calendario sin hora. |
| S-03 | Operación en línea; sin modo offline en el MVP. |
| S-04 | Autenticación local con correo/contraseña a través de un `AuthProvider`; sin SSO obligatorio en el MVP, pero preparado para OIDC (D-06). |
| S-05 | Un movimiento por activo; los lotes se evalúan en segunda fase. |
| S-06 | Un extintor puede registrarse inicialmente en almacén o en un área interna, con `entry_source` y motivo (aprobado D-03). |
| S-07 | El código se genera en servidor con prefijo `EXT-` y secuencia de 6 dígitos; no se importan códigos (D-04). |
| S-08 | El QR contiene solo el código estable, no una URL con datos ni datos personales. |
| S-09 | El número de serie es opcional y no único por defecto. |
| S-10 | Los umbrales de alerta se configuran después de la instalación; no hay valor por defecto. |
| S-11 | La condición técnica no cambia automáticamente por una inspección ni por el resultado de un servicio; el cambio es explícito y auditado (D-10, D-28). |
| S-12 | No se permite dar de baja un activo en mantenimiento externo; primero debe retornar o resolverse con un ajuste administrativo. |
| S-13 | Los documentos/certificados se registran como referencia textual en el MVP; no hay archivos, fotos ni firmas (D-13). |
| S-14 | El sistema será usado por menos de 100 usuarios y un inventario del orden de 10 000 extintores; confirmar volumen. |
| S-15 | Interfaz en español; no se requiere i18n en el MVP. |
| S-16 | Contraseñas de 12–128 caracteres, sin composición obligatoria, caducidad ni MFA en el MVP; el reset es solo administrativo (D-06b). |
| S-17 | Un extintor `NO_OPERATIVO` no puede estar asignado a un área; solo se ubica en almacén, taller o proveedor (D-26b). |
| S-18 | El vencimiento del equipo combina la fecha documentada del fabricante y la vida útil calculada por tipo; la categoría `EQUIPO` usa la más temprana y no se inventan fechas (D-12). |
| S-19 | La próxima fecha de inspección/mantenimiento/recarga/prueba se registra solo si el documento la indica; el MVP arranca sin umbrales de “por vencer” (D-11). |
| S-20 | No existe segunda aprobación en la aplicación: quien tiene el permiso ejecuta la operación y registra `authorized_by`, motivo y documento; el control es RBAC + auditoría (D-08b). |
| S-21 | Las alertas se consultan solo dentro de la aplicación; no hay correo, WhatsApp ni SMS en el MVP (D-20). |
| S-22 | El historial y la auditoría se conservan indefinidamente en el MVP; no hay purga, archivo ni anonimización (D-21). |

### 9.1 Realidad operativa declarada (levantamiento 2026-11-10; precisión D-02 el 2026-11-11)

Hechos aportados por el propietario. **No son reglas aprobadas**; el detalle y las preguntas están en `docs/levantamiento-procesos.md`.

| Tema | Realidad declarada | Efecto en el diseño |
|---|---|---|
| Estructura de ubicaciones | Sede → área; sin edificios ni pisos. El almacén central y el taller propio están dentro de una sede. Sedes y áreas se identifican solo por nombre. | Jerarquía de dos niveles con tipos `SEDE`, `ALMACEN`, `AREA` y `TALLER`; código interno generado; nombre único por sede (D-02). |
| Ruta de ingreso | No hay procedimiento fijo. Conviven almacén central, compra local directa, retorno de mantenimiento directo y traslado directo entre sedes. | El alta debe registrar la ubicación real con una fuente/motivo; "todo por almacén" no describe la práctica. |
| Evidencia de recepción | No hay estándar; varía. | Se fijó un mínimo por decisión: nombre del receptor + referencia documental. |
| Solicitud de equipos | Verbal o por llamada. | No hay rastro previo; `requested_by` se captura al despachar. Un módulo de solicitudes sería funcionalidad nueva. |
| Autorización de salida | No hay regla establecida. | No se puede asumir aprobación ni despacho de un paso como norma. |
| Confirmación de llegada | Varía; no siempre se confirma. | Un modelo de dos pasos dejaría equipos en limbo. |
| Responsabilidad | El responsable de sede recibe, pero no hay responsable individual por extintor. | No se añade custodio al activo; `received_by` registra recepción. |
| Devoluciones | Ocurren por daño/vencimiento y por rotación. | `RETORNO_ALMACEN` es real; un activo puede tener varios ciclos. |
| Mantenimiento | Taller propio, y algunos servicios se tercerizan según el equipo. | Deben convivir flujos interno y externo; el modelo actual asume solo externo. |
| Declaración de operatividad | Varía; no hay autoridad constante. | El cambio de condición debe ser explícito y auditado, no automático. |
| Documentos de servicio | Varían; no hay certificado universal. | La obligatoriedad de `document_ref` debe distinguir interno/externo. |
| Baja | Varía; no hay autoridad constante. | `authorized_by` obligatorio puede ser inviable tal como está. |
| Identificación física | Solo número de serie de fábrica. | No hay códigos que importar; todos los equipos requieren etiqueta nueva. |
| Inventario existente | Listado desactualizado. | La carga inicial requiere conciliación y verificación física. |

**Conclusión de diseño:** la organización no tiene procedimientos uniformes en casi ningún eslabón. SITE no puede limitarse a digitalizar la práctica; debe **proponer un mínimo de control** por operación y obtener aprobación explícita. Mientras eso no ocurra, los supuestos S-06 a S-12 siguen siendo supuestos, no reglas.

---

## 10. Decisiones que requieren respuesta antes de implementar

> **Estado al 2026-11-14:** el levantamiento está cerrado y las decisiones aprobadas figuran en `docs/decisiones-pendientes.md` (§2.2 y §2.4), incluidas D-08b, D-11, D-12, D-13, D-19, D-20 y D-21. Lo que sigue son las decisiones abiertas que bloquean fases concretas.

1. **D-14/D-22/D-23/D-25/D-29/D-30:** operación sin internet, volumen, despliegue, lotes, costos e idioma.

El detalle, la recomendación y el supuesto de cada una está en `docs/decisiones-pendientes.md`.

---

## 11. Criterios de éxito del producto

- Se puede reconstruir la ubicación actual de cada extintor desde sus movimientos y no desde una edición manual.
- Todo movimiento tiene fecha, origen, destino, responsables, motivo y usuario registrador.
- Un origen incorrecto se rechaza y no deja datos parciales.
- El historial no se puede borrar ni editar silenciosamente.
- Las fechas de equipo, inspección, mantenimiento, recarga y prueba hidrostática se consultan por separado.
- Una fecha no documentada se muestra como “sin configurar”, no como una fecha inventada.
- Un usuario sin permiso recibe 403 aunque invoque la API directamente.
- Un QR válido permite llegar a la ficha autenticada; uno inexistente no crea nada.
- Un activo dado de baja conserva ficha e historial y no participa en movimientos ordinarios.
- Las pruebas de transacción, concurrencia y permisos se ejecutan y reportan con resultados reales.

---

## 12. Próximo paso

1. Completar las decisiones abiertas de `decisiones-pendientes.md` (siguiente: D-22, D-23 y D-14).
2. Cerrar el alcance de la fase 1 (esquema y migración inicial) con las decisiones ya aprobadas.
3. Autorizar la fase 1 antes de escribir módulos funcionales.

La fase 0 ya está implementada y verificada. No se implementará código de módulos de negocio hasta recibir la aprobación de cada fase.
