# Levantamiento de procesos reales — SITE

> **Propósito:** registrar **hechos declarados por el propietario del proceso** sobre cómo opera hoy la organización, separados de los supuestos técnicos y de las reglas aprobadas.
>
> **Regla de este documento:** aquí no se inventan procedimientos. Si una respuesta es incompleta, se registra como incompleta. Un hecho registrado aquí **no** se convierte en regla de negocio hasta que el propietario lo apruebe y se traslade a `docs/reglas-de-negocio.md`.
>
> **Estado general:** levantamiento en curso. Fecha de inicio: 2026-11-10.

---

## 1. Método

- Se pregunta **una cosa a la vez**, en el orden del ciclo de vida del activo.
- Cada respuesta se registra con: pregunta, respuesta textual resumida, lectura, implicaciones y decisiones afectadas.
- Cuando una respuesta contradice un supuesto existente, se marca la contradicción y **no** se aplica el supuesto por defecto.
- Las actualizaciones se propagan a `docs/analisis-funcional.md`, `docs/reglas-de-negocio.md`, `docs/modelo-entidad-relacion.md` y `docs/decisiones-pendientes.md` cuando la respuesta sea estable.

---

## 2. Estado de las preguntas

| ID | Tema | Decisión relacionada | Estado |
|---|---|---|---|
| P-01 | Ingreso de equipos nuevos | D-03 | Respondida (parcial) |
| P-01b | Existencia de almacén en cada sede | D-03, D-02 | Respondida |
| P-01c | Excepciones a la ruta por almacén central | D-03, D-09 | Respondida |
| P-02 | Recepción en almacén y en sede, y documento de respaldo | D-08 | Respondida (parcial) |
| P-02b | Mínimo de evidencia que exigirá el sistema | D-08 | Respondida y aplicada |
| P-03 | Salida del almacén central a una sede | D-07, D-08, D-09 | Respondida |
| P-03b | Canal de solicitud de equipos por la sede | D-08, D-09 | Respondida |
| P-03c | Recepción en la sede y responsable del equipo | modelo, D-08 | Respondida |
| P-03d | Responsable por sede o por equipo | modelo | Respondida |
| P-03e | Confirmación de recepción en la sede | D-09 | Respondida |
| P-04 | Traslado entre sedes | D-02, D-09 | Respondida (parcial, ver P-01c) |
| P-05 | Devolución al almacén | D-03, D-09 | Respondida |
| P-06 | Tipo de prestador de mantenimiento | D-18, modelo | Respondida |
| P-06b | Alcance del taller propio (prueba hidrostática) | D-18, modelo | Respondida |
| P-07 | Quién declara operativo un equipo tras el servicio | D-10 | Respondida |
| P-08 | Documento o certificado del servicio | D-18 | Respondida |
| P-09 | Baja definitiva de un extintor | D-17, D-07 | Respondida |
| P-10 | Etiquetas y códigos existentes | D-04, D-05 | Respondida |
| P-11 | Listado de inventario existente | D-24 | Respondida |
| P-12 | Estructura real de ubicaciones | D-02 | Respondida y aplicada |
| P-13 | Proveedor de identidad corporativo | D-06 | Respondida y aplicada |
| P-14 | Vocabulario de condición técnica | D-26 | Respondida y aplicada |
| P-15 | Política de contraseñas y acceso | D-06b | Respondida y aplicada |
| P-16 | Efecto operativo de la condición técnica | D-26b | Respondida y aplicada |
| P-17 | Inspección y cambio de condición | D-28 | Respondida y aplicada |
| P-18 | Vencimiento del equipo y vida útil | D-12 | Respondida y aplicada |
| P-19 | Intervalos y umbrales de alerta | D-11 | Respondida y aplicada |
| P-20 | Aprobación de operaciones sensibles | D-08b | Respondida y aplicada |
| P-21 | Adjuntos, fotos o firmas | D-13 | Respondida y aplicada |
| P-22 | Formatos de reporte | D-19 | Respondida y aplicada |

---

## 3. Registro de respuestas

### P-01 — Ingreso de equipos nuevos

**Pregunta:** Cuando la organización recibe extintores nuevos (compra o reposición), ¿dónde se registran físicamente primero?

**Respuesta del propietario (2026-11-10):** no hay un procedimiento fijo. Varía por sede, por proyecto o por quién recibe el equipo.

**Lectura:**

- No existe hoy una regla organizacional uniforme que el sistema pueda reflejar tal cual.
- Por tanto, la práctica actual **no permite decidir** entre "todo entra a almacén" y "alta directa en área": ambas situaciones ocurren.
- El sistema no puede limitarse a "copiar" la práctica; tendrá que **imponer un procedimiento** o **permitir variantes controladas**.

**Qué NO se concluye todavía:**

- No se concluye que el alta en área sea aceptable como norma.
- No se concluye que todo deba pasar por almacén.
- No se adopta el supuesto S-06 ni la opción B de D-03.

**Implicaciones pendientes de definir:**

1. Si el sistema debe **estandarizar** (una sola regla para toda la organización) o **permitir variantes por sede/almacén**.
2. Qué evidencia existe hoy cuando un equipo no pasa por almacén (guía de remisión, factura, acta de entrega, correo, nada).
3. Si el equipo que llega directo a un área debe quedar registrado con un movimiento de ingreso en esa área y con qué motivo.

**Decisiones afectadas:** D-03 (bloqueante), D-08 (evidencia de recepción) y, de forma indirecta, D-02 (estructura de ubicaciones).

**Documentos actualizados:** `docs/decisiones-pendientes.md` (D-03 marcada en levantamiento, sin supuesto aplicado), `docs/analisis-funcional.md` (nota de levantamiento en curso).

---

### P-01b — Existencia de almacén en cada sede

**Pregunta:** ¿Todas las sedes cuentan con un almacén propio donde se guardan los extintores antes de instalarlos?

**Respuesta del propietario (2026-11-10):** existe **un solo almacén central**; desde allí se distribuye a todas las sedes.

**Lectura:**

- El flujo físico dominante es **almacén central → sede/área**. Esto hace viable la opción A de D-03 ("todo ingresa primero a almacén") sin obligar a transportes entre ciudades.
- La variabilidad declarada en P-01 puede referirse a **quién registra** o **cuándo se registra**, no necesariamente a la ruta física. Queda por confirmar.
- Los traslados entre sedes, si existen, no tienen un almacén intermedio: la ruta sería sede A → sede B directamente, o sede A → almacén central → sede B. Debe definirse.

**Qué NO se concluye todavía:**

- No se concluye que todo equipo pase por el almacén central: faltan las excepciones (compras locales, retornos de mantenimiento, traslados directos).
- No se adopta la opción A de D-03.
- No se define aún cuántas ubicaciones de tipo `ALMACEN` existirán en el modelo (hoy sería una).

**Implicaciones para el modelo:**

- `locations` necesitará al menos una ubicación de tipo `ALMACEN` (el central) y una jerarquía de sedes/áreas para destino.
- Un traslado directo entre sedes es un `TRASLADO` con origen y destino internos; el modelo ya lo soporta, pero la regla de negocio debe decidir si se permite o si se exige pasar por el almacén.

**Decisiones afectadas:** D-03, D-02 (estructura y cantidad de ubicaciones), y la ruta de traslados entre sedes.

**Documentos actualizados:** este registro (P-01b, H-03). Sin cambios en reglas ni en el modelo hasta confirmar excepciones.

---

### P-01c — Excepciones a la ruta por el almacén central

**Pregunta:** Además de la carga inicial de equipos ya instalados, ¿en qué casos un extintor llega a una sede sin pasar por el almacén central?

**Respuesta del propietario (2026-11-10):** **varias** de las situaciones planteadas:

- compras locales entregadas directamente en la sede;
- retornos de mantenimiento que se reinstalan directamente en su área;
- traslados directos entre sedes.

**Lectura:**

- La ruta "todo pasa por el almacén central" **no representa la realidad**. La opción A de D-03 queda descartada como descripción del proceso, aunque podría imponerse como política (con costo operativo).
- La opción C (compras nuevas → almacén, existentes → área) tampoco cubre el caso: hay compras nuevas que llegan directo a sede.
- La forma que se ajusta a los hechos es un **ingreso registrado en la ubicación real**, con un motivo o fuente que explique la ruta (compra local, retorno de mantenimiento, traslado, carga inicial). Esto es la opción B, pero con un matiz: no basta el tipo `INGRESO`; hace falta distinguir **por qué** el equipo aparece allí.

**Qué NO se concluye todavía:**

- No se adopta B formalmente.
- No se decide si el almacén central debe tener visibilidad o aprobación sobre las compras locales.
- No se decide quién recepciona en sede ni qué documento lo respalda.
- No se decide si un traslado directo entre sedes requiere autorización del almacén central.

**Implicaciones para el modelo (a validar, no aplicar aún):**

- `movements` ya tiene `reason` (obligatorio) y `document_ref`; podría ser suficiente.
- Si se quiere reportar por fuente de ingreso, haría falta un campo tipo `entry_source` (`COMPRA_CENTRAL`, `COMPRA_LOCAL`, `CARGA_INICIAL`, `RETORNO_MANTENIMIENTO`, `TRASLADO`) o un catálogo equivalente.
- Esto no se implementa hasta que el propietario confirme si necesita ese nivel de detalle.

**Decisiones afectadas:** D-03 (forma final), D-07 (quién autoriza compras locales), D-08 (evidencia de recepción), D-09 (traslado directo vs. tránsito).

**Documentos actualizados:** este registro (P-01c, H-04). Sin cambios en reglas ni en el modelo.

---

### P-02 — Recepción en el almacén central y documento de respaldo

**Pregunta:** Cuando llega un pedido de extintores al almacén central, ¿cómo se deja constancia de la recepción?

**Respuesta del propietario (2026-11-10):** varía según el caso (proveedor, volumen, sede).

**Lectura:**

- No hay un estándar de evidencia de recepción. No se puede asumir que siempre exista guía firmada, acta o registro digital.
- El sistema no puede "reflejar" un estándar inexistente: tendrá que **exigir un mínimo** o aceptar recepciones sin respaldo. Ambas son decisiones de política.
- Esto afecta directamente a D-08 y a la obligatoriedad de `document_ref` por tipo de movimiento.

**Qué NO se concluye todavía:**

- Si existe al menos un documento en todos los casos.
- Quién firma o recibe físicamente.
- Si el respaldo debe ser un archivo (foto/PDF) o basta una referencia textual.

**Implicaciones:** D-08 no puede resolverse con el supuesto A sin confirmar el mínimo exigible.

**Documentos actualizados:** este registro (P-02, H-05).

---

### P-02b — Mínimo de evidencia que exigirá el sistema

**Pregunta:** ¿Qué evidencia mínima debe exigir SITE para aceptar una recepción de extintores?

**Respuesta del propietario (2026-11-10):** **referencia documental + quién recibe**. Se exige nombre de quien recibe y una referencia textual (guía, factura u orden). Sin archivos en el MVP.

**Lectura:**

- Es una decisión de política, no una descripción de la práctica. Sustituye al estándar inexistente (H-05).
- Convierte `received_by` y `document_ref` en obligatorios para el `INGRESO`.
- No exige adjuntos: se mantiene el alcance sin almacenamiento de archivos.

**Aplicado en documentación:**

- `docs/reglas-de-negocio.md`: BR-051A (obligatoriedad en `INGRESO`) y BR-051B (referencia textual, sin archivo). Matriz de tipos de movimiento actualizada.
- `docs/decisiones-pendientes.md`: D-08 aprobada (evidencia y flujo de aprobación, D-08b).

**Pendiente relacionado:** si la carga inicial de equipos ya instalados puede quedar exenta de referencia documental (P-03). La aprobación de operaciones sensibles quedó resuelta en P-20 (D-08b): no hay segunda aprobación en la aplicación.

**Documentos actualizados:** reglas de negocio, decisiones pendientes y este registro.

---

### P-03 — Salida del almacén central a una sede

**Pregunta:** ¿Se requiere aprobación de alguien por encima del encargado de almacén para que un extintor salga del almacén central hacia una sede?

**Respuesta del propietario (2026-11-10):** no hay una regla establecida; depende de la sede, del volumen o de quién esté disponible.

**Lectura:**

- No se puede asumir un flujo de aprobación (`authorized_by` obligatorio) ni un despacho de un solo paso como norma existente. D-09 y D-08b resolvieron el modelo: un paso, sin segunda aprobación en la aplicación.
- El modelo actual soporta ambos: un `SALIDA` registrado por el encargado, o un paso previo de aprobación.
- Al igual que en P-01 y P-02, la ausencia de regla significa que SITE tendrá que **proponer un mínimo de control** y el propietario aprobarlo o rechazarlo.

**Qué NO se concluye todavía:**

- Quién solicita formalmente el equipo.
- Quién recibe en la sede y si firma.
- Si la recepción en sede se confirma en el sistema (dos pasos) o se da por confirmada al despachar.

**Decisiones afectadas:** D-09 (un paso vs. dos pasos), D-08 (aprobación), D-07 (quién puede despachar).

**Documentos actualizados:** este registro (P-03, H-06). Sin cambios en reglas.

---

### P-03b — Canal de solicitud de equipos por la sede

**Pregunta:** En la práctica, cuando una sede necesita extintores, ¿cómo los solicita al almacén central?

**Respuesta del propietario (2026-11-10):** por **llamada o verbalmente**.

**Lectura:**

- No existe un rastro documental de la solicitud: ni correo, ni formato, ni sistema.
- El dato `requested_by` del movimiento no puede obtenerse de un registro previo; tendría que capturarse en el momento del despacho.
- No hay evidencia de que se necesite un módulo de "solicitudes" con estados. Un flujo de solicitud formal sería una **funcionalidad nueva**, no la digitalización de algo existente.

**Qué NO se concluye todavía:**

- Si el encargado de almacén anota la solicitud en algún cuaderno o planilla.
- Si la sede confirma la recepción al almacén.
- Si el pedido verbal lo hace siempre la misma persona (responsable de sede).

**Decisiones afectadas:** D-09 (un paso vs. dos), alcance del MVP (módulo de solicitudes fuera o dentro).

**Documentos actualizados:** este registro (P-03b, H-07). Sin cambios en reglas.

---

### P-03c — Recepción en la sede y responsable del equipo

**Pregunta:** ¿Quién recibe el extintor en la sede y queda como responsable de ese equipo?

**Respuesta del propietario (2026-11-10):** el **responsable de la sede** (responsable o administrador local).

**Lectura:**

- Existe una figura constante de responsabilidad local, distinta del almacén central.
- Esa persona puede no ser usuaria de SITE; el sistema no debe exigirle una cuenta para que el movimiento tenga receptor.
- El modelo actual ya permite registrar `received_by` como texto en el movimiento. Lo que falta definir es si la responsabilidad es **por sede** o **por equipo**.

**Qué NO se concluye todavía:**

- Si cada extintor puede tener un responsable distinto dentro de la misma sede.
- Si el responsable de sede debe ser usuario del sistema (para notificaciones o para operar).
- Si el cambio de responsable requiere un movimiento o un registro aparte.

**Implicaciones posibles (no aplicadas):**

- Si la responsabilidad es **por sede**, se deriva de la ubicación y no requiere campos nuevos.
- Si es **por equipo**, haría falta persistir el responsable actual (nombre o usuario) y auditarlo; no bastaría `received_by` del último movimiento.

**Decisiones afectadas:** modelo de datos (responsable), D-07 (rol del responsable de sede).

**Documentos actualizados:** este registro (P-03c). Sin cambios en reglas ni en el modelo.

---

### P-03d — Alcance de la responsabilidad

**Pregunta:** ¿Cómo se asigna hoy la responsabilidad de los extintores dentro de una sede?

**Respuesta del propietario (2026-11-10):** **sin responsable individual**. El equipo pertenece a la sede; no hay una persona identificada como responsable por extintor.

**Lectura:**

- El "responsable de sede" de P-03c actúa como **receptor y referente local**, no como custodio registrado por activo.
- No se requiere un campo de responsable actual en `extinguishers` ni en `locations`.
- La responsabilidad es organizacional, no un dato que el sistema deba imponer o auditar por equipo.

**Qué NO se concluye todavía:**

- Si el responsable de sede debe ser usuario de SITE para operar (recibir, trasladar, inspeccionar).
- Si se requiere notificar a alguien cuando un equipo vence.

**Implicaciones para el modelo:**

- Se mantiene `movements.received_by` como texto: registra quién recibió, no una custodia permanente.
- **No** se añade `current_responsible_*` a `extinguishers`.
- Los reportes por responsable no son viables con este dato; si se piden, habría que definir un responsable y volver a esta decisión.

**Decisiones afectadas:** modelo de datos (descartada la responsabilidad por equipo en el MVP), D-07.

**Documentos actualizados:** este registro (P-03d, H-08). Sin cambios en reglas ni en el modelo.

---

### P-03e — Confirmación de recepción en la sede

**Pregunta:** ¿La sede confirma al almacén que recibió los equipos?

**Respuesta del propietario (2026-11-10):** varía según el caso.

**Lectura:**

- No hay una práctica constante de confirmación. Algunas veces se firma guía, otras se avisa y otras no se confirma.
- Un modelo de **dos pasos** (`EN_TRANSITO` hasta confirmación) dejaría equipos en limbo cuando nadie confirme. Sin una práctica de confirmación, ese estado se vuelve un problema operativo, no un control.
- La opción de **un paso** (el despacho actualiza la ubicación al destino) es la única compatible con la práctica declarada, pero pierde la evidencia de que el equipo llegó.

**Qué NO se concluye todavía:**

- No se adopta D-09 A ni B.
- No se decide si la firma de guía debe registrarse como documento del movimiento.

**Implicaciones:** si se elige un paso, el `SALIDA` puede exigir `received_by` y `document_ref` como evidencia declarada, sin confirmación posterior. Si se elige dos pasos, hace falta definir qué ocurre con equipos no confirmados y quién los cierra.

**Decisiones afectadas:** D-09 (bloqueante para el motor de movimientos), D-08.

**Documentos actualizados:** este registro (P-03e). Sin cambios en reglas.

---

### P-05 — Devolución al almacén

**Pregunta:** ¿En qué situaciones un extintor vuelve al almacén central después de estar instalado?

**Respuesta del propietario (2026-11-10):**

- cuando está **dañado o vencido**;
- por **rotación o renovación** de equipos;
- en otros casos, **varía**.

**Lectura:**

- `RETORNO_ALMACEN` es una operación **real**, no teórica: el estado `EN_ALMACEN` se reutiliza después de la instalación.
- Un mismo activo puede tener varios ciclos almacén → sede → almacén a lo largo de su vida; el historial debe soportarlo (ya lo hace: `asset_sequence` por activo).
- La baja puede ocurrir desde el almacén, no solo desde la sede.
- "Vencido" como motivo de devolución sugiere que los equipos con fechas críticas se concentran en el almacén para revisión o disposición.

**Qué NO se concluye todavía:**

- Si un equipo dañado va primero al almacén y luego a mantenimiento, o directo al proveedor.
- Quién decide la devolución y con qué documento.
- Si la rotación implica dar de baja el equipo viejo o reasignarlo.

**Implicaciones para el modelo:** ninguna estructural. `RETORNO_ALMACEN` ya existe y la máquina de estados permite `ASIGNADO → EN_ALMACEN`.

**Decisiones afectadas:** D-03 (flujo de retorno), D-09, D-17 (baja desde almacén).

**Documentos actualizados:** este registro (P-05, H-09). Sin cambios en reglas.

---

### P-06 — Tipo de prestador de mantenimiento

**Pregunta:** ¿Quién realiza hoy el mantenimiento, la recarga y la prueba hidrostática?

**Respuesta del propietario (2026-11-10):** **taller propio** de la organización.

**Lectura — conflicto con el modelo actual:**

- El modelo asume un **proveedor externo**: `maintenance_orders.provider_id` es `NOT NULL` hacia `external_parties`, y el estado `EN_MANTENIMIENTO` exige colocación `EXTERNAL` (BR-022, sección 3.1).
- Si el taller es interno, el activo **no sale de la organización**: queda en una ubicación interna, pero no disponible para asignación. El modelo actual no representa ese caso sin forzarlo.
- El documento ya prevé servicios internos (`maintenance_services.maintenance_order_id` nullable, `performed_by_user_id`), pero no un **envío a un taller interno** con su propio movimiento.

**Opciones de representación (no aplicadas):**

| Opción | Implicación |
|---|---|
| A. Taller como ubicación interna de tipo `TALLER` | Requiere añadir el tipo al enum, permitir `EN_MANTENIMIENTO` con colocación `INTERNAL` en taller, y que envío/retorno sean movimientos entre ubicaciones. Es lo más fiel a la realidad. |
| B. Taller como contraparte `EXTERNAL_PARTY` de tipo `TALLER` | No cambia la estructura, pero etiqueta como "externa" a un área propia; distorsiona reportes y semántica. |
| C. Taller como "servicio interno" sin movimiento | El equipo seguiría `ASIGNADO` mientras está en el taller; la ubicación sería falsa. No recomendado. |

**Qué NO se concluye todavía:**

- Si el taller propio hace también la prueba hidrostática o esa se terceriza.
- Dónde está físicamente el taller (mismo local que el almacén u otro).
- Quién autoriza el envío y quién declara el equipo operativo al retorno.

**Decisiones afectadas:** D-18 (documentos), D-10 (condición), D-17 (baja), y el modelo de datos (invariantes de `EN_MANTENIMIENTO`).

**Documentos actualizados:** este registro (P-06, H-10). **No** se modificó el modelo todavía.

---

### P-06b — Alcance del taller propio

**Pregunta:** ¿El taller propio realiza también la recarga y la prueba hidrostática, o alguna se envía a un tercero?

**Respuesta del propietario (2026-11-10):** **varía según el equipo**. Algunos servicios se hacen en el taller propio y otros se envían a un tercero.

**Lectura:**

- El sistema debe soportar **ambos flujos**: taller interno y proveedor externo, para el mismo tipo de servicio y para equipos distintos.
- La opción A de P-06 (taller como ubicación interna) **no sustituye** al flujo externo; se suma.
- Esto descarta cualquier diseño que asuma un único prestador.

**Qué NO se concluye todavía:**

- Qué tipos de extintor o de servicio van a terceros.
- Dónde está físicamente el taller propio.
- Si el proveedor externo recoge en la sede o el equipo pasa primero por el almacén.

**Implicaciones para el modelo (no aplicadas):**

- `maintenance_orders.provider_id` tendría que admitir nulo o distinguir "orden interna" de "orden externa".
- `EN_MANTENIMIENTO` tendría que aceptar colocación `INTERNAL` (taller) y `EXTERNAL` (proveedor).
- Los movimientos de envío/retorno necesitan origen y destino de tipo `LOCATION` o `EXTERNAL_PARTY` según el caso.
- `maintenance_services` ya distingue `performed_by_user_id` (interno) y `provider_id` (externo); esa parte no cambia.

**Decisiones afectadas:** D-18, D-10, D-17 y el modelo de datos.

**Documentos actualizados:** este registro (P-06b, H-11). Sin cambios en reglas ni en el modelo.

---

### P-07 — Quién declara operativo un equipo tras el servicio

**Pregunta:** Cuando un extintor vuelve del taller o del proveedor, ¿quién decide que queda nuevamente operativo?

**Respuesta del propietario (2026-11-10):** **varía según el caso**.

**Lectura:**

- No hay una autoridad formal constante que declare la operatividad.
- Por tanto, no se puede asumir que el certificado del técnico cambie la condición automáticamente (opción A de D-10), ni que Seguridad siempre lo haga (opción B).
- Cualquier automatismo del tipo "resultado aprobado → operativo" produciría equipos operativos sin una decisión registrada en los casos en que nadie declaró nada.
- La alternativa coherente con la práctica es registrar el **resultado del servicio como evidencia** y exigir un **cambio de condición explícito y auditado** por alguien autorizado. Quién es ese alguien quedó resuelto en D-27 (ver actualización).

**Qué NO se concluye todavía:**

- No se adopta D-10 A, B ni C.
- No se define el permiso `extinguishers.condition` más allá de la propuesta.

**Implicaciones:** el cambio de condición no debe ser un efecto secundario silencioso del retorno; debe ser una acción con motivo y usuario.

**Decisiones afectadas:** D-10 (mapeo), D-27 (quién cambia la condición), D-07.

**Documentos actualizados:** este registro (P-07, H-12). Sin cambios en reglas.

**Actualización (2026-11-12):** D-27 aprobada con opción A. `SEGURIDAD` y `ADMIN` pueden cambiar la condición con motivo obligatorio; la evidencia documental es opcional; `ALMACEN` y `CONSULTA` reciben 403. El resultado del servicio sigue siendo solo evidencia (D-10).

---

### P-08 — Documento o certificado del servicio

**Pregunta:** ¿El taller o el proveedor entrega algún documento del servicio al devolver el extintor?

**Respuesta del propietario (2026-11-10):** **varía según el caso** (servicio interno o externo, tipo de equipo).

**Lectura:**

- No hay un documento universal. Exigir certificado en todos los retornos bloquearía casos reales; no exigir nada dejaría el historial sin evidencia.
- El modelo ya soporta ambos extremos: `certificate_no`, `certificate_date` y `document_ref` son opcionales en `maintenance_services`; el retorno exige `document_ref` en la matriz actual, lo que **podría ser demasiado estricto** si el taller interno no emite nada.
- La decisión de D-18 tendrá que distinguir, como mínimo, servicio interno y externo.

**Qué NO se concluye todavía:**

- No se adopta D-18 A ni B.
- No se define si el retorno interno puede registrarse sin `document_ref`.

**Implicaciones:** la matriz de campos obligatorios por tipo de movimiento (sección 12 de reglas) tendrá que revisarse cuando D-18 se decida. No se modificó aún.

**Decisiones afectadas:** D-18, D-13 (adjuntos), matriz de campos obligatorios.

**Documentos actualizados:** este registro (P-08, H-13). Sin cambios en reglas.

---

### P-09 — Baja definitiva

**Pregunta:** ¿Quién autoriza la baja de un extintor?

**Respuesta del propietario (2026-11-10):** **varía según el caso** (motivo, costo, sede).

**Lectura:**

- No hay una autoridad formal única. La baja ocurre, pero sin un responsable constante.
- El modelo actual exige `authorized_by` en `BAJA`. Si nadie autoriza formalmente, esa exigencia obligaría a inventar un nombre o a bloquear la baja.
- Alternativas: (a) mantener `authorized_by` obligatorio y que el usuario con permiso registre a quien autorizó; (b) permitir que quien tiene el permiso ejecute y quede él como responsable; (c) exigir un documento de respaldo.
- Ninguna se adopta todavía.

**Qué NO se concluye todavía:**

- No se adopta D-17 (baja en mantenimiento).
- No se define si la baja requiere aprobación de un segundo usuario (D-08).
- No se decide qué pasa con equipos vencidos que nadie retira.

**Implicaciones:** la matriz de permisos necesita un dueño claro para `extinguishers.retire`; la regla de `authorized_by` puede tener que replantearse.

**Decisiones afectadas:** D-17, D-07, D-08.

**Documentos actualizados:** este registro (P-09, H-14). Sin cambios en reglas.

---

### P-10 — Etiquetas y códigos existentes

**Pregunta:** ¿Los extintores tienen hoy una etiqueta, placa o código que los identifique individualmente?

**Respuesta del propietario (2026-11-10):** **solo el número de serie de fábrica**. No hay código interno ni etiqueta propia.

**Lectura:**

- **No hay códigos internos que importar**: la opción B de D-04 (importación controlada de códigos) pierde su caso de uso principal. La opción A (código generado) se ajusta a la realidad.
- **Todos los equipos necesitan etiqueta nueva** con su código y QR. Es un trabajo físico de despliegue, no solo de software.
- El número de serie es el **único dato existente** para emparejar equipos durante la carga inicial; si falta o está repetido, el emparejamiento falla.
- La etiqueta del proveedor no sirve como identidad estable: puede cambiar con cada servicio.

**Qué NO se concluye todavía:**

- No se adopta D-04 A ni D-05 A/B.
- No se decide si el número de serie podrá usarse para buscar (sí) o como identidad (no).
- No se sabe cuántos equipos hay ni cuántos seriales son legibles.

**Implicaciones:** el alta masiva y el etiquetado son un entregable operativo de la fase 4, no un detalle. El riesgo de seriales duplicados o ilegibles debe tratarse en la importación.

**Decisiones afectadas:** D-04, D-05, D-16 (unicidad de serie), D-24 (datos existentes).

**Documentos actualizados:** este registro (P-10, H-15). Sin cambios en reglas ni en el modelo.

---

### P-11 — Listado de inventario existente

**Pregunta:** ¿Existe hoy un listado del inventario de extintores?

**Respuesta del propietario (2026-11-10):** existe un listado, pero está **desactualizado**.

**Lectura:**

- La carga inicial **no es una importación limpia**: hay datos, pero no son confiables como fuente de verdad.
- El inventario real tendrá que establecerse con **verificación física** (conteo y lectura de seriales) y etiquetado, no solo con el archivo.
- El listado sirve como **punto de partida** para conciliar, no como verdad.
- Aumenta el riesgo de seriales repetidos, faltantes o ilegibles, y de equipos que existen físicamente pero no en la planilla (o al revés).

**Qué NO se concluye todavía:**

- Cuántos registros y equipos hay.
- En qué formato está el listado y quién lo mantiene.
- Quién valida la calidad de los datos.

**Implicaciones:** D-24 pasa de "importar un CSV" a "conciliar y depurar"; el *dry-run* y el reporte de diferencias son obligatorios. La fase 4 incluye trabajo operativo de campo.

**Decisiones afectadas:** D-24, D-16, D-03.

**Documentos actualizados:** este registro (P-11, H-16). Sin cambios en reglas ni en el modelo.

---

### P-12 — Estructura real de ubicaciones

**Pregunta:** ¿Qué niveles de ubicación existen dentro de una sede? ¿Dónde están el almacén central y el taller propio? ¿Sedes y áreas tienen códigos?

**Respuesta del propietario (2026-11-11):**

- Los niveles reales son **Sede → área**; no se usan edificios, pisos ni puntos.
- El **almacén central está dentro de una sede**, no es una ubicación independiente.
- El **taller propio está dentro de una sede**.
- Sedes y áreas se identifican **solo por nombre**; no hay códigos existentes.

**Lectura:**

- La jerarquía necesaria es de dos niveles: una `SEDE` raíz y ubicaciones hijas de tipo `ALMACEN`, `TALLER` o `AREA`.
- Un área no contiene otra área ni un almacén contiene áreas.
- El código de ubicación es interno: lo puede generar el sistema sin pedir nomenclatura al usuario.
- La unicidad relevante es el nombre dentro de la sede, no el nombre global.

**Qué NO se concluye todavía:**

- Cuántas sedes existen y cómo se llaman.
- Si una sede puede tener más de un almacén; no se declaró, así que no se impone un límite.
- Si en el futuro se necesitarán edificios o pisos; el modelo queda preparado para añadirlos con migración.

**Implicaciones:** D-02 se aprueba con jerarquía de dos niveles, tipos `SEDE`, `ALMACEN`, `AREA` y `TALLER`, código generado y nombre único por sede. El taller de D-31 y el almacén central se representan como hijos de su sede.

**Decisiones afectadas:** D-02 (aprobada), D-03, D-31.

**Documentos actualizados:** este registro (P-12, H-17, H-18), `decisiones-pendientes.md`, `reglas-de-negocio.md` (BR-027A a BR-027E), `modelo-entidad-relacion.md`, `diseno-api.md`, `plan-de-pruebas.md` y `analisis-funcional.md`.

---

### P-13 — Proveedor de identidad

**Pregunta:** ¿La organización exige un proveedor de identidad corporativo (Microsoft 365/Entra ID, Google Workspace, LDAP/OIDC) para iniciar sesión?

**Respuesta del propietario (2026-11-11):** no hay un proveedor de identidad corporativo obligatorio.

**Lectura:**

- Las cuentas se crean y administran dentro de SITE.
- No se depende de un tenant, de una configuración externa ni de que cada usuario tenga cuenta corporativa.
- La autenticación local no impide adoptar SSO después, siempre que el módulo no mezcle identidad con permisos.

**Qué NO se concluye todavía:**

- La política de contraseñas, caducidad, recuperación y doble factor: resuelta en D-06b (2026-11-12).
- Si en el futuro la organización adoptará identidad corporativa; el diseño queda preparado.

**Implicaciones:** D-06 se aprueba con opción C. El MVP implementa el proveedor `LOCAL`; el servicio de sesión (tokens, permisos, auditoría) es independiente del proveedor, de modo que un OIDC posterior no rehace el módulo.

**Decisiones afectadas:** D-06 (aprobada), D-06b (aprobada el 2026-11-12), D-07.

**Documentos actualizados:** este registro (P-13, H-19), `decisiones-pendientes.md`, `reglas-de-negocio.md` (BR-171 a BR-178), `modelo-entidad-relacion.md`, `diseno-api.md`, `plan-de-pruebas.md`, `plan-implementacion.md` y `analisis-funcional.md`.

---

### P-14 — Vocabulario de condición técnica

**Pregunta:** ¿Las cuatro condiciones propuestas (`OPERATIVO`, `OBSERVADO`, `NO_OPERATIVO`, `PENDIENTE_INSPECCION`) cubren la operación, o se necesitan estados adicionales o un vocabulario propio?

**Respuesta del propietario (2026-11-12):** los cuatro valores son suficientes; no se requieren estados adicionales ni existe otro vocabulario que deba respetarse.

**Lectura:**

- No hace falta un catálogo administrable: el conjunto es estable y cerrado.
- Un valor nuevo sería un cambio de modelo, no una configuración operativa.
- La condición se elige al alta y se cambia con una acción auditada; no se deduce de la ubicación ni del estado logístico.

**Qué NO se concluye todavía:**

- Qué efecto operativo tiene cada condición: resuelto en D-26b (2026-11-12); `NO_OPERATIVO` no puede estar en un área.
- Si una inspección la cambia automáticamente: resuelto en D-28 (2026-11-12); no la cambia.

**Quién puede cambiarla (D-27, aprobada el 2026-11-12):** `SEGURIDAD` y `ADMIN`, con motivo obligatorio y evidencia documental opcional.

**Implicaciones:** D-26 se aprueba con enum fijo de cuatro valores. Agregar o quitar un valor exige migración, análisis de impacto y pruebas de regresión.

**Decisiones afectadas:** D-26 (aprobada), D-26b (aprobada el 2026-11-12), D-27, D-28.

**Documentos actualizados:** este registro (P-14, H-20), `decisiones-pendientes.md`, `reglas-de-negocio.md` (BR-012A/BR-012B), `modelo-entidad-relacion.md`, `diseno-api.md`, `plan-de-pruebas.md`, `plan-implementacion.md` y `analisis-funcional.md`.

---

### P-15 — Política de contraseñas y acceso

**Pregunta:** ¿Qué longitud y reglas debe cumplir una contraseña? ¿Caduca? ¿Cómo se recupera el acceso? ¿Se exige un segundo factor?

**Respuesta del propietario (2026-11-12):** se adopta la política moderna. Contraseñas de 12 a 128 caracteres, sin reglas de composición ni caducidad forzada; el reset lo hace el administrador; sin segundo factor en el MVP.

**Lectura:**

- La política prioriza longitud y bloqueo por intentos sobre reglas de composición.
- No se depende de correo para recuperar el acceso.
- El segundo factor puede añadirse después sin cambiar el modelo de usuarios.

**Qué NO se concluye todavía:**

- La recuperación por correo (autoservicio), que depende del canal de notificaciones (D-20).
- Si en el futuro se exigirá MFA; el diseño no lo impide.

**Implicaciones:** D-06b se aprueba con opción A. El backend valida la política y rechaza contraseñas comunes; el reset administrativo obliga cambio.

**Decisiones afectadas:** D-06b (aprobada), D-06, D-20.

**Documentos actualizados:** este registro (P-15, H-21), `decisiones-pendientes.md`, `reglas-de-negocio.md` (BR-179A a BR-179E), `diseno-api.md`, `plan-de-pruebas.md`, `plan-implementacion.md`, `requerimientos.md` y `analisis-funcional.md`.

---

### P-16 — Efecto operativo de la condición técnica

**Pregunta:** ¿La condición técnica bloquea movimientos? ¿Puede un extintor `NO_OPERATIVO` instalarse en un área?

**Respuesta del propietario (2026-11-12):** un equipo no operativo no debe instalarse en un área. Puede permanecer en almacén o taller, o enviarse a mantenimiento. Las condiciones observada y pendiente de inspección no impiden instalarlo, pero deben advertirse.

**Lectura:**

- La condición tiene efecto operativo, no es solo informativa.
- El sistema debe impedir la asignación de un equipo `NO_OPERATIVO` para que el registro no valide una situación insegura.
- No se necesita un permiso de excepción en el MVP.

**Qué NO se concluye todavía:**

- Si en el futuro hará falta una excepción autorizada; queda fuera del MVP.
- Si una inspección puede cambiar la condición automáticamente: resuelto en D-28 (2026-11-12); no la cambia.

**Implicaciones:** D-26b se aprueba con opción B. El backend rechaza destino `AREA` para `NO_OPERATIVO` y rechaza el cambio a `NO_OPERATIVO` mientras el equipo está asignado en un área.

**Decisiones afectadas:** D-26b (aprobada), D-27, D-28.

**Documentos actualizados:** este registro (P-16, H-22), `decisiones-pendientes.md`, `reglas-de-negocio.md` (BR-014A a BR-014D), `modelo-entidad-relacion.md`, `diseno-api.md`, `plan-de-pruebas.md`, `plan-implementacion.md`, `requerimientos.md` y `analisis-funcional.md`.

---

### P-17 — Inspección y cambio de condición

**Pregunta:** Si una inspección resulta `RECHAZADO`, ¿el equipo pasa automáticamente a `NO_OPERATIVO`?

**Respuesta del propietario (2026-11-12):** no. La inspección deja su resultado y sus fechas; el cambio de condición es una decisión aparte, hecha por alguien autorizado.

**Lectura:**

- El resultado de la inspección es evidencia, igual que el de un servicio (D-10).
- Mezclar la inspección con el cambio de condición dificultaría explicar quién declaró operativo o no operativo un equipo.
- La ficha debe mostrar el último resultado para que un rechazo no pase desapercibido.

**Qué NO se concluye todavía:**

- Si más adelante se añadirá una sugerencia con confirmación en la misma pantalla; queda como mejora posterior.
- La política de frecuencia de inspecciones: resuelta en D-11 (P-19); solo fecha indicada y sin umbral inicial.

**Implicaciones:** D-28 se aprueba con opción A. La inspección no escribe `technical_condition`; el cambio usa el endpoint de D-27.

**Decisiones afectadas:** D-28 (aprobada), D-10, D-27, D-11.

**Documentos actualizados:** este registro (P-17, H-23), `decisiones-pendientes.md`, `reglas-de-negocio.md` (BR-103/BR-103A), `modelo-entidad-relacion.md`, `diseno-api.md`, `plan-de-pruebas.md`, `plan-implementacion.md`, `requerimientos.md` y `analisis-funcional.md`.

---

### P-18 — Vencimiento del equipo y vida útil

**Pregunta:** ¿La fecha de vencimiento del equipo es la del fabricante, la de una vida útil calculada, la de un certificado, o no aplica para todos los tipos? ¿Qué documento la respalda?

**Respuesta del propietario (2026-11-12):** el extintor trae una fecha documentada por el fabricante y la organización también aplica una vida útil calculada que varía por tipo de extintor.

**Lectura:**

- Hay dos fuentes válidas y no deben mezclarse: la fecha documentada y la calculada.
- La vida útil no es universal; se configura por tipo y no se fija en código.
- Si falta un dato, el sistema no debe inventar una fecha.
- Para una alerta de seguridad, la fecha más restrictiva (la más temprana) es la adecuada para la categoría `EQUIPO`.

**Qué NO se concluye todavía:**

- Los años concretos de cada tipo: los define la organización en el catálogo, no el sistema.
- La frecuencia de inspecciones y los umbrales de alerta: resuelta en D-11 (P-19).

**Implicaciones:** D-12 se aprueba con opción A ampliada. `extinguisher_types.useful_life_years` es opcional; la categoría `EQUIPO` usa la más temprana entre documentada y calculada; cambiar los años recalcula y audita.

**Decisiones afectadas:** D-12 (aprobada), D-11.

**Documentos actualizados:** este registro (P-18, H-24), `decisiones-pendientes.md`, `reglas-de-negocio.md` (BR-107 a BR-107E), `modelo-entidad-relacion.md`, `diseno-api.md`, `plan-de-pruebas.md`, `plan-implementacion.md`, `requerimientos.md` y `analisis-funcional.md`.

---

### P-19 — Intervalos y umbrales de alerta

**Pregunta:** ¿Qué política define la próxima inspección, mantenimiento, recarga y prueba hidrostática? ¿Con cuánta anticipación se marca “por vencer”?

**Respuesta del propietario (2026-11-12):** no se deben calcular intervalos. La próxima fecha se registra solo si el certificado, el proveedor o el responsable la indica. Tampoco hay umbrales aprobados al inicio: el sistema debe arrancar sin “por vencer”.

**Lectura:**

- El sistema no suma meses ni años desde el último evento; registra la fecha indicada.
- Si el documento no indica próxima fecha, la categoría queda `SIN_FECHA_CONFIGURADA`.
- Sin umbral configurado solo se distingue vencido, vigente y sin fecha.
- Los umbrales son configurables por categoría y se cargan cuando exista una política aprobada.

**Qué NO se concluye todavía:**

- Los valores concretos de anticipación: no existen aprobados; se configurarán después.
- Si en el futuro se adoptará un cálculo automático por intervalo: requeriría una nueva decisión.

**Implicaciones:** D-11 se aprueba con A + C + sin umbral inicial. No se siembran `alert_settings`; `days_before = NULL` hasta configuración.

**Decisiones afectadas:** D-11 (aprobada), D-12.

**Documentos actualizados:** este registro (P-19, H-25), `decisiones-pendientes.md`, `reglas-de-negocio.md` (BR-108A/BR-108B, BR-122, BR-125/BR-125A), `modelo-entidad-relacion.md`, `diseno-api.md`, `plan-de-pruebas.md`, `plan-implementacion.md`, `requerimientos.md` y `analisis-funcional.md`.

---

### P-20 — Aprobación de operaciones sensibles

**Pregunta:** ¿Se requiere que otro usuario apruebe dentro de la aplicación las operaciones sensibles (baja, ajuste)?

**Respuesta del propietario (2026-11-12):** no. Quien tiene el permiso ejecuta la operación y registra el nombre de quien autoriza, el motivo y el documento. La autorización ocurre fuera del sistema.

**Lectura:**

- La evidencia mínima (nombre + referencia documental) ya estaba definida en D-08.
- Un flujo de aprobación añadiría estados pendientes, pantallas y notificaciones que hoy no se necesitan.
- El control se mantiene con permisos de servidor y auditoría de cada acción.

**Qué NO se concluye todavía:**

- Si en el futuro se exigirá aprobación de cuatro ojos para bajas/ajustes; queda como mejora posterior.
- Si se incorporarán firmas o archivos; resuelta en P-21 (D-13): no en el MVP.

**Implicaciones:** D-08b se aprueba con opción A. No hay tabla, estado `PENDIENTE` ni endpoint de aprobación; `authorized_by` es un snapshot de nombre.

**Decisiones afectadas:** D-08b (aprobada), D-08, D-13.

**Documentos actualizados:** este registro (P-20, H-26), `decisiones-pendientes.md`, `reglas-de-negocio.md` (BR-050/BR-050A/BR-050B, BR-071, BR-165/BR-166), `modelo-entidad-relacion.md`, `diseno-api.md`, `plan-de-pruebas.md`, `plan-implementacion.md`, `requerimientos.md` y `analisis-funcional.md`.

---

### P-21 — Adjuntos, fotos o firmas

**Pregunta:** ¿Basta una referencia documental (`document_ref`) o se deben subir actas, certificados, fotos y firmas?

**Respuesta del propietario (2026-11-13):** basta la referencia textual en el MVP. No se suben archivos, fotos ni firmas.

**Lectura:**

- Los archivos añaden almacenamiento, validación de MIME/tamaño, permisos, respaldo y posible antivirus; no son necesarios para el alcance actual.
- La referencia textual ya identifica el documento físico y permite auditarlo.
- La firma electrónica es un proyecto aparte y requiere análisis legal y técnico.

**Qué NO se concluye todavía:**

- Si en el futuro se adjuntarán actas o certificados: requerirá una nueva decisión y análisis de almacenamiento.
- Qué tipos de archivo y límites se aceptarían: fuera del MVP.

**Implicaciones:** D-13 se aprueba con opción A. No hay endpoints de subida ni tabla de adjuntos; `document_ref` es texto de hasta 100 caracteres.

**Decisiones afectadas:** D-13 (aprobada), D-08b, D-18.

**Documentos actualizados:** este registro (P-21, H-27), `decisiones-pendientes.md`, `reglas-de-negocio.md` (BR-051C/BR-051D), `modelo-entidad-relacion.md`, `diseno-api.md`, `plan-de-pruebas.md`, `plan-implementacion.md`, `requerimientos.md` y `analisis-funcional.md`.

---

### P-22 — Formatos de reporte

**Pregunta:** ¿Basta consultar en pantalla y exportar CSV, o se requieren PDF/Excel con formato oficial?

**Respuesta del propietario (2026-11-13):** basta JSON + CSV en el MVP. PDF/Excel quedan para una fase posterior.

**Lectura:**

- El CSV cubre el uso operativo: se abre en Excel y se archiva fuera del sistema.
- La consulta en pantalla se mantiene para el trabajo diario, con filtros y paginación de servidor.
- El PDF/Excel con formato oficial exige plantillas, librerías y pruebas de formato; conviene definirlo cuando exista un requisito de presentación concreto.
- No se generan archivos persistentes: la exportación se entrega en la respuesta y no se almacena en el servidor.

**Qué NO se concluye todavía:**

- Qué plantillas y campos exactos llevará cada PDF/Excel: se define en fase 2.
- Si se requiere firma o sello digital en los reportes: fuera del MVP (ver D-13).

**Implicaciones:** D-19 se aprueba con opción A. La exportación exige el permiso `reports.export` y usa los mismos filtros que la consulta; los endpoints de PDF/Excel no existen en el MVP.

**Decisiones afectadas:** D-19 (aprobada), D-13.

**Documentos actualizados:** este registro (P-22, H-28), `decisiones-pendientes.md`, `requerimientos.md` (RF-REP-01..06), `diseno-api.md` (§4.7), `plan-de-pruebas.md` (T-REP-01..05), `plan-implementacion.md` (fase 7) y `analisis-funcional.md`.

---

## 4. Contradicciones y hallazgos

| ID | Hallazgo | Efecto |
|---|---|---|
| H-01 | La organización no tiene un procedimiento uniforme de ingreso. | D-03 no puede resolverse observando la práctica; requiere una decisión de política. |
| H-02 | El supuesto S-06 ("alta en almacén o área") no está respaldado por un hecho declarado. | Se mantiene como supuesto técnico, no como descripción de la realidad. |
| H-03 | Existe un único almacén central, ubicado dentro de una sede; no hay almacén por sede. | "Todo pasa por almacén" es físicamente viable, pero obliga a definir la ruta de traslados entre sedes y las excepciones. |
| H-04 | La ruta de ingreso no es única: compras locales directas, retornos de mantenimiento directos y traslados directos entre sedes evitan el almacén central. | D-03 opción A no describe la realidad. El sistema debe registrar el ingreso en la ubicación real con una fuente/motivo verificable. |
| H-05 | No hay estándar de evidencia de recepción en el almacén central. | D-08 no puede resolverse con el supuesto "nombre + documento"; hay que fijar un mínimo exigible por el sistema. |
| H-06 | No hay regla establecida para autorizar salidas del almacén central. | D-09 y la parte de aprobación de D-08 requieren una propuesta de mínimo de control, no una descripción de la práctica. |
| H-07 | Las solicitudes de equipos se hacen por llamada o verbalmente. | No hay rastro previo de la solicitud; `requested_by` debe capturarse al despachar. Un módulo de solicitudes sería funcionalidad nueva. |
| H-08 | No existe responsable individual por extintor; la responsabilidad es de la sede. | No se añade responsable actual al activo. `received_by` registra recepción, no custodia. |
| H-09 | Las devoluciones al almacén ocurren por daño/vencimiento y por rotación. | `RETORNO_ALMACEN` es una operación real; un activo puede tener varios ciclos almacén ↔ sede. |
| H-10 | El mantenimiento lo hace un taller propio, no un proveedor externo. | El modelo actual (`provider_id` obligatorio, `EN_MANTENIMIENTO` = colocación externa) no representa el caso. Requiere decisión de representación. |
| H-11 | El alcance del taller varía por tipo de equipo; conviven servicios internos y externos. | El sistema debe soportar ambos flujos; la ubicación interna de taller no reemplaza al proveedor externo. |
| H-12 | No hay una autoridad formal constante que declare operativo un equipo tras el servicio. | D-10 no puede ser automático; el cambio de condición debe ser una acción explícita y auditada. D-27 lo asigna a `SEGURIDAD` y `ADMIN`. |
| H-13 | No hay un documento estándar de los servicios realizados; depende del caso. | D-18 debe distinguir servicio interno y externo; la obligatoriedad de `document_ref` en el retorno no puede ser uniforme sin decisión. |
| H-14 | No hay una autoridad formal constante para autorizar bajas. | D-17 y el permiso `extinguishers.retire` requieren una definición explícita; `authorized_by` obligatorio puede ser inviable tal como está. |
| H-15 | Los equipos solo tienen número de serie de fábrica; no hay código interno ni etiqueta propia. | No hay códigos que importar; todos los equipos requieren etiqueta nueva. El serial es el único dato para emparejar la carga inicial. |
| H-16 | Existe un listado de inventario, pero desactualizado. | La carga inicial requiere conciliación y verificación física; el archivo no es fuente de verdad. |
| H-17 | La estructura real es Sede → área, sin edificios ni pisos; el almacén central y el taller propio están dentro de una sede. | D-02: jerarquía de dos niveles con tipos `SEDE`, `ALMACEN`, `AREA` y `TALLER`; las sedes no alojan activos directamente. |
| H-18 | No existen códigos de sede ni de área; solo nombres. | D-02: código interno generado por el servidor; nombre único dentro de la sede y repetible entre sedes. |
| H-19 | No hay proveedor de identidad corporativo obligatorio. | D-06: autenticación local en el MVP con proveedor desacoplado; las cuentas y contraseñas se administran en SITE. |
| H-20 | El vocabulario de condición técnica es estable y se limita a cuatro valores; no hay códigos ni estados propios. | D-26: enum fijo; sin catálogo administrable. D-26b define el efecto de cada valor. |
| H-21 | No existía una política de contraseñas ni segundo factor definidos. | D-06b: 12–128 caracteres, sin composición ni caducidad, rechazo de comunes, reset por `ADMIN` y sin MFA en el MVP. |
| H-22 | No había una regla sobre si la condición técnica impide instalar un equipo. | D-26b: `NO_OPERATIVO` no puede estar en un área; solo almacén, taller o proveedor. `OBSERVADO` y `PENDIENTE_INSPECCION` se permiten con advertencia. |
| H-23 | No había una regla sobre el efecto de una inspección en la condición técnica. | D-28: la inspección no cambia la condición; el resultado es evidencia y el cambio es una acción aparte (D-27). |
| H-24 | No había una regla única sobre el vencimiento del equipo: existe fecha documentada del fabricante y vida útil variable por tipo. | D-12: se registran ambas fuentes; `EQUIPO` usa la más temprana; sin datos no se inventa fecha. |
| H-25 | No había una política de intervalos ni umbrales de “por vencer”. | D-11: solo fecha indicada, sin cálculo de intervalos y sin umbrales iniciales. |
| H-26 | No estaba definido si las operaciones sensibles requerían aprobación de otro usuario en la aplicación. | D-08b: sin segunda aprobación; `authorized_by` es un nombre registrado y el control es RBAC + auditoría. |
| H-27 | No estaba definido si la evidencia documental requería archivos, fotos o firmas. | D-13: solo referencia textual; sin adjuntos ni firma electrónica en el MVP. |
| H-28 | No estaba definido el nivel de formato de los reportes ni si se requería PDF/Excel desde el inicio. | D-19: JSON + CSV en el MVP; PDF/Excel en fase 2, con plantillas definidas después. |

---

## 5. Próxima pregunta

Levantamiento cerrado el 2026-11-10 y ampliado con D-02, D-06, D-06b, D-08b, D-11, D-12, D-13, D-19, D-26, D-26b, D-27 y D-28. No quedan preguntas de ubicaciones, identidad, política de acceso, condición técnica, inspecciones, vencimiento del equipo, umbrales de alerta, aprobación de operaciones sensibles, adjuntos ni formatos de reporte pendientes. La siguiente decisión abierta por impacto es **D-20 (notificaciones)**, seguida de **D-21 (retención)** y **D-22 (volumen)**. No se inicia implementación funcional sin aprobación.
