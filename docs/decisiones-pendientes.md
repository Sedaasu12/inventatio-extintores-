# Decisiones pendientes — SITE

> **Estado:** las decisiones de este documento **no están aprobadas**. Cada una tiene una recomendación técnica y un supuesto por defecto para no bloquear el análisis, pero el propietario del proceso debe confirmarlas antes de la fase indicada.
>
> **Regla:** si una decisión no se responde, se implementa el supuesto por defecto y se registra como supuesto, no como regla del negocio. Las decisiones que cambian el modelo de datos o la seguridad se consideran bloqueantes.

---

## 1. Cómo leer este documento

| Campo | Significado |
|---|---|
| **ID** | Referencia estable para discusiones y documentos. |
| **Pregunta** | Decisión concreta que debe tomar el propietario. |
| **Por qué importa** | Impacto en diseño, datos, seguridad u operación. |
| **Opciones** | Alternativas viables. |
| **Recomendación** | Propuesta del equipo técnico, con razón. |
| **Si no se responde** | Supuesto que se aplicará, marcado como supuesto. |
| **Bloquea** | Fase que no puede cerrarse sin la decisión. |
| **Estado** | `Abierta`, `Propuesta`, `Aprobada`, `Rechazada`. |

---

## 2. Decisiones bloqueantes prioritarias

Estado al 2026-11-12. El registro formal de aprobaciones está en §2.2 a §2.4; esta tabla resume el estado vigente.

| Orden | ID | Tema | Decisión / recomendación vigente | Estado | Bloquea |
|---:|---|---|---|---|---|
| 1 | D-03 | Ubicación inicial: almacén vs área | Alta en la ubicación real + `entry_source` y motivo (B+). | Aprobada | Fase 4 |
| 2 | D-04 | Códigos existentes/manuales vs generados | Solo generado por el servidor; sin importación en el MVP. | Aprobada | Fase 4 |
| 3 | D-05 | Contenido del QR: código vs URL | Código plano `EXT-000125`. | Aprobada | Fase 4/9 |
| 4 | D-07 | Roles y quién autoriza cada operación | Cuatro roles como semilla, permisos granulares. | Aprobada | Fase 2 |
| 5 | D-08 | Evidencia de autorización/recepción | Nombre del receptor + referencia documental; aprobación en app pendiente (D-08b). | Parcial | Fase 5 |
| 6 | D-10 | Condición técnica tras mantenimiento | Resultado como evidencia; cambio explícito y auditado. | Aprobada | Fase 6 |
| 7 | D-11 | Intervalos y umbrales de alerta | Solo fecha indicada; sin umbral inicial; configurable después. | Aprobada | Fase 7 |
| 8 | D-12 | Vencimiento del equipo | Documentada del fabricante + vida útil por tipo; `EQUIPO` usa la más temprana. | Aprobada | Fase 4/7 |
| 9 | D-17 | Baja de un activo en mantenimiento | Prohibida con orden activa; ajuste excepcional de `ADMIN`. | Aprobada | Fase 6 |
| 10 | D-06 | Autenticación local vs SSO corporativo | Local con `AuthProvider` desacoplado; sin SSO obligatorio confirmado. | Aprobada | Fase 2 |
| 11 | D-02 | Estructura real de sedes/almacenes/áreas | Sede → almacén/taller/área; dos niveles, código generado y nombre único por sede. | Aprobada | Fase 3 |
| 12 | D-24 | Inventario existente para importar | Conciliación por sede + verificación física, con dry-run. | Aprobada | Fase 4 |
| 13 | D-15 | Zona horaria | `America/Lima`; eventos UTC, fechas calendario `DATE`. | Aprobada | Fase 1 |
| 14 | D-16 | Unicidad del número de serie | No único; advertir y reportar duplicados. | Aprobada | Fase 4 |

---

## 2.1 Estado tras el levantamiento de procesos (2026-11-10)

Hechos declarados por el propietario; el detalle está en `docs/levantamiento-procesos.md`. **No son decisiones aprobadas.**

| Decisión | Hallazgo | Efecto sobre el default |
|---|---|---|
| D-03 | No hay procedimiento fijo de ingreso; existen compras locales, retornos y traslados directos. | **Suspendido.** "Alta en almacén o área" no describe la realidad ni basta: falta la fuente del ingreso. |
| D-04 | No hay códigos internos; solo número de serie de fábrica. | La importación de códigos pierde su caso principal; el código generado queda como opción natural. |
| D-05 | No hay etiquetas propias; todos los equipos requieren etiqueta nueva. | Sin efecto sobre el payload; sí sobre el esfuerzo de despliegue. |
| D-07 | No hay autoridad formal constante para salidas ni bajas. | La matriz propuesta es una semilla, no una descripción de roles existentes. |
| D-08 | Evidencia mínima definida (referencia + receptor). | **Aprobada parcialmente**; el flujo de aprobación sigue abierto. |
| D-09 | La confirmación de llegada varía y con frecuencia no ocurre. | Un modelo de dos pasos es riesgoso: los equipos quedarían en tránsito. |
| D-10 | No hay autoridad constante que declare operatividad. | El mapeo automático resultado → condición no es viable sin decisiones adicionales. |
| D-17 | La autoridad de baja varía. | La regla de `authorized_by` obligatorio debe revisarse. |
| D-18 | Los documentos de servicio varían; interno vs. externo. | La obligatoriedad de `document_ref` no puede ser uniforme. |
| D-24 | Existe un listado, pero desactualizado. | No es una importación limpia; requiere conciliación y verificación física. |

---

## 2.2 Aprobaciones del 2026-11-10

El propietario aprobó las recomendaciones presentadas y autorizó el inicio de la fase 0. Registro formal:

| ID | Decisión aprobada | Responsable | Fecha |
|---|---|---|---|
| D-03 | Ingreso en la ubicación real + fuente del ingreso (`entry_source`). | Propietario | 2026-11-10 |
| D-04 | Solo código generado por el sistema; sin importación de códigos en el MVP. | Propietario | 2026-11-10 |
| D-05 | QR con código plano `asset_code`. | Propietario | 2026-11-10 |
| D-07 | Matriz de cuatro roles como semilla, con permisos granulares. | Propietario | 2026-11-10 |
| D-09 | Salida en un paso; sin `EN_TRANSITO`. | Propietario | 2026-11-10 |
| D-10 | El resultado del servicio es evidencia; el cambio de condición es explícito y auditado. | Propietario | 2026-11-10 |
| D-16 | Número de serie no único; advertencia y reporte de duplicados. | Propietario | 2026-11-10 |
| D-17 | Baja prohibida con orden de mantenimiento activa; excepción vía `AJUSTE` de `ADMIN`. | Propietario | 2026-11-10 |
| D-18 | `document_ref` obligatorio en servicio/retorno externo; opcional en interno. | Propietario | 2026-11-10 |
| D-24 | Carga inicial por conciliación y verificación física, con dry-run. | Propietario | 2026-11-10 |
| D-31 | Taller propio como ubicación interna de tipo `TALLER`; convive con proveedor externo. | Propietario | 2026-11-10 |

**Alcance de la aprobación:** estas once decisiones, el alcance de la fase 0 y el ajuste del plan para que la fase 0 dependa solo de D-01 y D-15. Las demás decisiones conservan su estado anterior y **no** se aplican como reglas hasta confirmación específica.

### 2.3 Confirmación en revisión (2026-11-11)

El propietario revisó las decisiones una por una y **confirmó** las once, sin cambios respecto de lo registrado el 2026-11-10:

| ID | Opción confirmada |
|---|---|
| D-03 | B+ — ingreso en la ubicación real + `entry_source` |
| D-04 | A — solo código generado |
| D-05 | A — QR con código plano |
| D-07 | A — matriz de cuatro roles como semilla |
| D-09 | A — salida en un paso |
| D-10 | B — cambio de condición explícito y auditado |
| D-16 | A — serial no único, con reporte de duplicados |
| D-17 | A — baja prohibida con orden activa |
| D-18 | A — documento obligatorio solo en flujo externo |
| D-24 | C — conciliación por sede con verificación física |
| D-31 | A — taller como ubicación interna `TALLER` |

**Correcciones aplicadas durante la revisión:** BR-003 y la nota de API sobre `assetCode` (D-04); BR-089, modelo, RF-MAN-05 y T-MAN-15 sobre ausencia de mapeo automático (D-10).

### 2.4 Confirmaciones adicionales (2026-11-11)

| ID | Opción confirmada |
|---|---|
| D-01 | A — single-tenant |
| D-15 | A — zona única `America/Lima` |
| D-02 | A — Sede → (Almacén/Taller/Área), código generado y nombre único por sede (2026-11-11) |
| D-06 | C — autenticación local con `AuthProvider` desacoplado para OIDC posterior (2026-11-11) |
| D-26 | A — condición técnica como enum fijo de cuatro valores (2026-11-12) |
| D-27 | A — `SEGURIDAD` y `ADMIN` cambian la condición con motivo (2026-11-12) |
| D-06b | A — contraseña de 12–128, sin caducidad ni MFA; reset por `ADMIN` (2026-11-12) |
| D-26b | B — `NO_OPERATIVO` bloquea la asignación a áreas (2026-11-12) |
| D-28 | A — la inspección no cambia la condición automáticamente (2026-11-12) |
| D-12 | A ampliada — fecha documentada + vida útil por tipo; `EQUIPO` usa la más temprana (2026-11-12) |
| D-11 | A + C — solo fecha indicada y sin umbral inicial (2026-11-12) |

---

## 3. Decisiones detalladas

### D-01 — ¿Una sola organización o múltiples organizaciones aisladas?

**Pregunta:** ¿SITE será usado por una sola organización (con varias sedes) o por varias organizaciones con datos completamente aislados?

**Por qué importa:** multi-tenant requiere `organization_id` en casi todas las tablas, políticas de aislamiento, pruebas de fuga de datos y un modelo de administración distinto. Añadirlo después es costoso.

**Opciones:**

- A. Single-tenant: una organización, varias sedes.
- B. Multi-tenant desde el inicio.
- C. Single-tenant con diseño preparado para añadir `organization_id` después.

**Recomendación:** A para el MVP. El alcance descrito habla de una organización; multi-tenant añade complejidad y riesgo de seguridad sin beneficio inmediato.

**Si no se responde:** single-tenant.

**Decisión aprobada (2026-11-11):** opción **A**, single-tenant. No se añade `organization_id` ni políticas de aislamiento multi-tenant.

**Bloquea:** fase 1 (modelo). **Estado:** aprobada.

---

### D-02 — ¿Cuál es la estructura real de ubicaciones?

**Pregunta:** ¿Qué niveles existen realmente (sede, almacén, edificio, piso, área, punto) y cuáles son obligatorios? ¿Los almacenes son independientes o pertenecen a una sede?

**Por qué importa:** define la jerarquía, los reportes por sede, la ubicación inicial y las reglas de estado (`EN_ALMACEN` vs `ASIGNADO`).

**Opciones:**

- A. Jerarquía flexible con tipos y padre opcional (recomendada).
- B. Jerarquía fija de tres niveles (sede → almacén → área).
- C. Ubicaciones planas sin jerarquía.

**Recomendación:** A. Permite empezar simple y crecer sin cambiar el modelo. Cargar la estructura real antes de la fase 3.

**Si no se responde:** no se aplica ningún supuesto; la estructura se mantiene en levantamiento.

**Hechos confirmados (2026-11-11):**

- Los niveles reales son **Sede → área**; no se usan edificios, pisos ni puntos.
- El **almacén central está dentro de una sede**; no es una ubicación independiente.
- El **taller propio está dentro de una sede**.
- Las sedes y áreas se identifican **solo por nombre**; no hay códigos existentes.

**Decisión aprobada (2026-11-11):** opción **A**, con alcance acotado al MVP:

- `SEDE` es la raíz (`parent_id` nulo).
- `ALMACEN`, `TALLER` y `AREA` son hijos de una sede; no se anidan entre sí.
- El enum `LocationType` del MVP queda en `SEDE`, `ALMACEN`, `AREA`, `TALLER`.
- El código de ubicación lo genera el servidor (`UBI-000001`), es único e inmutable.
- El nombre es único dentro de su sede, sin distinguir mayúsculas; puede repetirse entre sedes.
- La baja de ubicaciones es lógica; no se borran ubicaciones con historial.

**Bloquea:** fase 1 (modelo de `locations`), fase 3 (ubicaciones) y reportes. **Estado:** aprobada.

---

### D-03 — ¿Todo extintor debe ingresar primero a un almacén?

**Pregunta:** Al dar de alta un extintor, ¿debe registrarse siempre en un almacén y luego salir a un área, o se permite registrarlo directamente en un área ya instalada?

**Por qué importa:** afecta el movimiento inicial, la exactitud histórica y la adopción. Si se obliga a pasar por almacén, se crean movimientos ficticios para equipos que ya estaban instalados. Si se permite el alta en área, el historial empieza en esa área.

**Opciones:**

- A. Solo alta en almacén; luego `SALIDA` al área.
- B. Alta en almacén o área; el `INGRESO` inicial refleja la ubicación real.
- C. Alta solo en área para equipos existentes y en almacén para compras nuevas (flujo mixto).

**Recomendación:** B, con una bandera de política si la organización exige A. Documentar el motivo del alta en área.

**Respuesta del propietario (2026-11-10):** no existe un procedimiento fijo; varía por sede, proyecto o persona que recibe. La práctica actual no respalda ninguna opción. Ver `docs/levantamiento-procesos.md` (P-01, H-01).

**Si no se responde:** no se aplica el supuesto por defecto mientras la decisión esté en levantamiento.

**Decisión aprobada (2026-11-10):** opción **B+** — alta en la ubicación real (almacén o área) con motivo y **fuente del ingreso** (`entry_source`). No se exige paso por almacén.

**Bloquea:** fase 4 (alta). **Estado:** aprobada.

---

### D-04 — ¿Se aceptan códigos existentes o solo los genera el sistema?

**Pregunta:** ¿La organización ya tiene códigos internos (planillas, etiquetas, sistemas previos)? ¿Deben conservarse? ¿O se puede generar un código nuevo para todos?

**Por qué importa:** el código es inmutable y se imprime en el QR. Cambiarlo después obliga a reetiquetar. La importación de códigos existentes debe validar duplicados y no reutilización.

**Opciones:**

- A. Solo generado por el sistema (`EXT-000001`).
- B. Generado por el sistema, con importación controlada de códigos existentes.
- C. Código manual obligatorio definido por la organización.

**Recomendación:** B. Garantiza unicidad y permite migrar sin romper etiquetas existentes. La importación debe ser un proceso administrativo, con dry-run y reporte.

**Si no se responde:** B; el alta normal genera el código.

**Decisión aprobada (2026-11-10):** opción **A** — solo código generado por el sistema (`EXT-` + secuencia). Sin proceso de importación de códigos en el MVP.

**Bloquea:** fase 4. **Estado:** aprobada.

---

### D-05 — ¿El QR contiene el código o una URL?

**Pregunta:** ¿La etiqueta debe poder abrir la ficha al escanearla con la cámara nativa del teléfono (URL), o basta con que la app de SITE resuelva el código?

**Por qué importa:** una URL necesita un dominio estable y HTTPS; si cambia el dominio, las etiquetas impresas dejan de funcionar. El código plano es estable y no depende del dominio, pero requiere abrir la app y escanear.

**Opciones:**

- A. Código plano `EXT-000125`.
- B. URL estable `https://sitio.example/e/EXT-000125`.
- C. Código + URL en la etiqueta (dos códigos) o URL configurable.

**Recomendación:** A en el MVP. Es estable, no contiene datos cambiantes y funciona con cámara/lector dentro de la app. Evaluar B cuando exista un dominio definitivo y se quiera deep link.

**Si no se responde:** A.

**Decisión aprobada (2026-11-10):** opción **A** — el QR contiene solo `asset_code` en texto plano.

**Bloquea:** fase 4/9 (etiqueta y escaneo). **Estado:** aprobada.

---

### D-06 — ¿Autenticación local o SSO corporativo?

**Pregunta:** ¿Los usuarios iniciarán sesión con correo/contraseña gestionados por SITE, o la organización exige SSO (Microsoft Entra ID, Google Workspace, LDAP/OIDC)?

**Por qué importa:** cambia el módulo de auth, el almacenamiento de contraseñas, la gestión de usuarios y las pruebas. Añadir SSO después es posible, pero implica rehacer parte del flujo.

**Opciones:**

- A. Local con correo/contraseña y JWT/refresh.
- B. OIDC/SSO desde el inicio.
- C. Local en MVP, con diseño de auth desacoplado para SSO posterior.

**Recomendación:** C. Si la organización ya tiene SSO obligatorio, B desde el inicio.

**Hecho confirmado (2026-11-11):** la organización **no tiene un proveedor de identidad corporativo obligatorio**; las cuentas se crean dentro de SITE.

**Decisión aprobada (2026-11-11):** opción **C**. Autenticación local con correo y contraseña, con el módulo de autenticación desacoplado:

- La identidad se resuelve mediante un `AuthProvider`; el MVP solo implementa el proveedor `LOCAL`.
- El servicio de sesión (emisión, rotación y revocación de tokens) es independiente del proveedor; añadir OIDC después no cambia permisos, auditoría ni sesión.
- Contraseñas con hash Argon2id (o bcrypt costo 12); nunca texto plano.
- Sesión con JWT de acceso corto y refresh rotativo en cookie `HttpOnly`; la reutilización de un refresh revoca la familia.
- No hay autorregistro: los usuarios los crea un `ADMIN` y el primer ingreso exige cambio de contraseña.
- La política exacta de contraseñas, recuperación y doble factor se aprobó en **D-06b** (ver abajo).

**Derivada resuelta — D-06b:** longitud y complejidad, caducidad, recuperación y doble factor se aprobaron el 2026-11-12 (ver la decisión D-06b a continuación).

**Bloquea:** fase 2. **Estado:** aprobada.

---

### D-06b — ¿Qué política de contraseñas, recuperación y doble factor se aplica?

**Pregunta:** ¿Qué longitud y reglas debe cumplir una contraseña? ¿Caduca? ¿Cómo se recupera el acceso? ¿Se exige un segundo factor?

**Por qué importa:** define el validador del backend, las pruebas de autenticación y el soporte. Una política mal calibrada produce contraseñas débiles o fricción innecesaria.

**Opciones:**

- A. Política moderna: mínimo 12, sin composición ni caducidad, rechazo de contraseñas comunes; sin MFA.
- B. Política tradicional: mínimo 8 con 3 de 4 clases y caducidad cada 90 días; sin MFA.
- C. Política moderna + TOTP obligatorio para `ADMIN`.

**Recomendación:** A.

**Decisión aprobada (2026-11-12):** opción **A**.

- Longitud mínima 12 y máxima 128; sin reglas de composición obligatorias ni caducidad forzada.
- Se rechazan contraseñas comunes o triviales mediante una lista local versionada.
- El usuario cambia su contraseña con la actual (`/auth/change-password`).
- El reset administrativo lo ejecuta `ADMIN` con `users.manage` y obliga cambio en el siguiente ingreso.
- Sin autoservicio de recuperación por correo hasta que D-20 defina el canal; sin MFA en el MVP.
- No se almacenan pistas de contraseña ni historial de contraseñas en el MVP.

**Bloquea:** fase 2. **Estado:** aprobada.

---

### D-07 — ¿Quién puede hacer cada operación?

**Pregunta:** Confirmar la matriz de roles: ¿quién da de alta, quién autoriza salidas, quién envía a mantenimiento, quién inspecciona, quién cambia la condición técnica, quién da de baja y quién configura umbrales?

**Por qué importa:** la segregación de funciones es un control de seguridad y de auditoría. Una matriz ambigua produce operaciones no autorizadas o bloqueos.

**Opciones:**

- A. Matriz propuesta en `docs/diseno-api.md` (ADMIN, ALMACEN, SEGURIDAD, CONSULTA).
- B. Roles personalizados por la organización.
- C. Un solo rol operativo con auditoría (no recomendado).

**Recomendación:** A como semilla, con permisos granulares y posibilidad de ajustar roles. Confirmar especialmente baja, ajuste y cambio de condición.

**Si no se responde:** A.

**Decisión aprobada (2026-11-10):** opción **A** — cuatro roles (`ADMIN`, `ALMACEN`, `SEGURIDAD`, `CONSULTA`) como semilla editable; el backend verifica permisos, no nombres de rol.

**Bloquea:** fase 2. **Estado:** aprobada.

---

### D-08 — ¿Cómo se evidencia la autorización y la recepción?

**Pregunta:** ¿Basta registrar el nombre de quien autoriza/entrega/recibe, o se requiere que otro usuario apruebe dentro de la app, firma digital, foto o documento firmado?

**Por qué importa:** afecta el modelo de movimiento, el flujo de aprobación y la evidencia legal. Los receptores externos pueden no tener cuenta.

**Opciones:**

- A. Nombre + documento de referencia (MVP).
- B. Aprobación de otro usuario dentro de la app.
- C. Firma electrónica/foto/acta adjunta (fase 2).
- D. Combinación: nombre + documento en MVP; aprobación para casos sensibles.

**Recomendación:** A en MVP; D para bajas/ajustes. Si la organización exige firma legal, adelantar C con un análisis específico.

**Respuesta del propietario (2026-11-10):** evidencia mínima = **nombre de quien recibe + referencia documental textual** (guía, factura u orden). Sin archivos en el MVP. Aplicado por ahora al `INGRESO` (BR-051A/BR-051B). Queda pendiente definir si las operaciones sensibles requieren aprobación de otro usuario.

**Si no se responde (parte restante):** A; `authorized_by` obligatorio en baja/ajuste/mantenimiento.

**Bloquea:** fase 5 (movimientos). **Estado:** aprobada parcialmente (evidencia); flujo de aprobación pendiente.

---

### D-09 — ¿Se requiere estado “en tránsito” y recepción en dos pasos?

**Pregunta:** Cuando un extintor sale de un almacén, ¿la ubicación cambia al confirmar la entrega, o queda “en tránsito” hasta que el receptor confirma?

**Por qué importa:** un modelo de dos pasos requiere un estado pendiente, recordatorios y resolución de recepciones no confirmadas. Añade complejidad y posibles equipos “en limbo”.

**Opciones:**

- A. Un paso: la confirmación del movimiento actualiza la ubicación al destino (MVP).
- B. Dos pasos: `EN_TRANSITO` hasta recepción.
- C. Un paso, con campo de receptor y fecha de recepción posterior.

**Recomendación:** A en MVP. Si la organización necesita control de recepción, evaluar B en fase 2.

**Si no se responde:** A; `EN_TRANSITO` queda reservado y no se usa.

**Decisión aprobada (2026-11-10):** opción **A** — un paso. El despacho actualiza la ubicación al destino; receptor y documento se capturan en el movimiento. `EN_TRANSITO` no se usa.

**Bloquea:** fase 5. **Estado:** aprobada.

---

### D-10 — ¿Qué resultado de mantenimiento habilita qué condición técnica?

**Pregunta:** ¿Un certificado `APROBADO` deja el equipo `OPERATIVO`? ¿`APROBADO_CON_OBSERVACIONES` lo deja `OBSERVADO`? ¿`RECHAZADO` lo deja `NO_OPERATIVO`? ¿Quién puede declararlo operativo?

**Por qué importa:** no se debe asumir que un equipo vuelve operativo solo por regresar del taller. La condición técnica es una evaluación autorizada.

**Opciones:**

- A. Mapeo propuesto: aprobado → operativo; con observaciones → observado; rechazado → no operativo.
- B. El sistema no cambia la condición; un usuario autorizado la actualiza manualmente después del retorno.
- C. Mapeo configurable por tipo de servicio.

**Recomendación:** A para el MVP, con posibilidad de que `SEGURIDAD` sobrescriba con motivo. Si la organización prefiere control humano total, B.

**Si no se responde:** A.

**Decisión aprobada (2026-11-10):** opción **B** — el resultado del servicio es evidencia; la condición técnica solo cambia con una acción explícita, con motivo y auditoría. Sin mapeo automático.

**Bloquea:** fase 6. **Estado:** aprobada.

---

### D-11 — ¿Cuáles son los intervalos y umbrales aprobados?

**Pregunta:** ¿Qué política documentada define la próxima inspección, mantenimiento, recarga y prueba hidrostática? ¿Qué umbral de “por vencer” se usa por categoría?

**Por qué importa:** el sistema no debe inventar periodos. Un umbral incorrecto genera falsas alertas o falsa tranquilidad. La política puede variar por tipo de equipo, país o contrato.

**Opciones:**

- A. Configurar por categoría con la política aprobada; sin valores por defecto.
- B. Intervalos fijos por tipo de extintor definidos por el responsable de seguridad.
- C. Solo registrar fechas indicadas por certificados/proveedor, sin calcular próximas fechas.

**Recomendación:** A + C: registrar la fecha indicada y configurar umbrales; no calcular intervalos automáticamente. Ejemplo de 30 días solo como valor de prueba, nunca como norma.

**Decisión aprobada (2026-11-12):** **A + C + sin umbral inicial**:

- La próxima fecha de inspección, mantenimiento, recarga y prueba hidrostática se toma **solo** de la fecha indicada por el certificado, el proveedor o el responsable autorizado. El sistema no calcula intervalos automáticamente.
- Si el evento no indica próxima fecha, la categoría queda `SIN_FECHA_CONFIGURADA`; no se conserva una fecha anterior como vigente.
- El MVP arranca con `days_before = NULL` para todas las categorías: solo se distingue `VENCIDO`, `VIGENTE` y `SIN_FECHA_CONFIGURADA`. No se genera `POR_VENCER` hasta que se configure un umbral.
- Los umbrales son configurables por categoría y no se siembran valores por defecto.
- Cambiar un umbral solo afecta la clasificación, no las fechas fuente, y queda auditado.
- Cualquier valor de ejemplo (por ejemplo, 30 días) es de prueba y no una norma.

**Bloquea:** fase 7. **Estado:** aprobada.

---

### D-12 — ¿Qué significa “vencimiento del equipo” y de qué documento procede?

**Pregunta:** ¿La fecha de vencimiento del equipo es la del fabricante, la de vida útil, la de un certificado, o no aplica para todos los tipos? ¿Qué documento la respalda?

**Por qué importa:** es una categoría distinta de inspección/mantenimiento/recarga/prueba. Si se confunde, las alertas son incorrectas.

**Opciones:**

- A. Campo opcional `manufacturer_expiry_date` respaldado por documentación; no se calcula.
- B. Vida útil calculada desde fabricación (requiere regla aprobada).
- C. No usar esta categoría en el MVP.

**Recomendación:** A. Si la organización usa vida útil calculada, definir la regla y la fuente antes de implementarla.

**Hecho confirmado (2026-11-12):** el extintor trae una fecha de vencimiento o vida útil documentada por el fabricante. La organización también aplica una vida útil calculada que **varía por tipo de extintor**.

**Decisión aprobada (2026-11-12):** opción **A ampliada** (documentada + calculada por tipo):

- Se registra `manufacturer_expiry_date` cuando existe y está respaldada por documentación (placa, etiqueta, certificado o ficha del fabricante). Es opcional.
- Se configura `useful_life_years` **por tipo de extintor** (`extinguisher_types`), entero opcional y sin valor por defecto. No se fija un periodo en código ni en la migración.
- Fecha calculada = `manufacture_date` + `useful_life_years`.
- La fecha de la categoría `EQUIPO` es la **más temprana** entre la documentada y la calculada cuando ambas existen.
- Si falta `manufacture_date`, falta `useful_life_years` o no hay fecha documentada, no se calcula ni se inventa una fecha; la categoría queda `SIN_FECHA_CONFIGURADA`.
- Cambiar `useful_life_years` de un tipo exige auditoría y recalcula las fechas objetivo `EQUIPO` de los equipos de ese tipo.
- La fecha documentada y la calculada se muestran por separado en la ficha; no se sobrescribe el dato del fabricante.

**Bloquea:** fase 4/7. **Estado:** aprobada.

---

### D-13 — ¿Se requieren adjuntos, fotos o firmas en el MVP?

**Pregunta:** ¿Basta una referencia documental (`document_ref`) o se deben subir actas, certificados, fotos y firmas?

**Por qué importa:** los archivos requieren almacenamiento, validación de MIME/tamaño, permisos, respaldo y posible antivirus. Aumentan el alcance del MVP.

**Opciones:**

- A. Solo referencia textual en MVP; archivos en fase 2.
- B. Adjuntos en MVP para mantenimiento/baja.
- C. Adjuntos y firma electrónica desde el inicio.

**Recomendación:** A. Si el proceso legal exige evidencia, B para mantenimiento y baja, con análisis de almacenamiento.

**Si no se responde:** A.

**Bloquea:** no bloquea MVP; afecta fase 2. **Estado:** abierta.

---

### D-14 — ¿Se requiere operación sin internet?

**Pregunta:** ¿Los almacenes o sedes operan en lugares sin conectividad? ¿Se necesita registrar movimientos offline y sincronizar?

**Por qué importa:** offline exige cola local, resolución de conflictos, idempotencia, cifrado local y una UX de sincronización. No se debe simular éxito sin confirmación del servidor.

**Opciones:**

- A. Online solamente (MVP).
- B. PWA con caché de lectura y cola de escritura.
- C. App nativa offline.

**Recomendación:** A. Reevaluar si hay evidencia de falta de conectividad.

**Si no se responde:** A.

**Bloquea:** no bloquea MVP; arquitectura. **Estado:** abierta.

---

### D-15 — ¿Cuál es la zona horaria y el alcance geográfico?

**Pregunta:** ¿La operación es solo en Perú (`America/Lima`) o en varios países/zona horaria? ¿Las fechas límite se evalúan a medianoche local?

**Por qué importa:** un error de zona horaria puede marcar una alerta como vencida un día antes o después.

**Opciones:**

- A. Una zona horaria configurable (`America/Lima`).
- B. Múltiples zonas por sede.
- C. UTC para todo.

**Recomendación:** A en MVP; almacenar eventos en UTC y fechas calendario como `DATE`.

**Si no se responde:** A.

**Decisión aprobada (2026-11-11):** opción **A** — zona única `America/Lima`; eventos en UTC y fechas calendario como `DATE`, evaluadas a medianoche local.

**Bloquea:** fase 1. **Estado:** aprobada.

---

### D-16 — ¿El número de serie debe ser único?

**Pregunta:** ¿La organización exige unicidad del número de serie del fabricante? ¿Qué hacer si falta o está duplicado por error de captura?

**Por qué importa:** una restricción única puede bloquear la carga de datos reales; permitir duplicados puede dificultar la identificación.

**Opciones:**

- A. No único; se advierte duplicado.
- B. Único cuando está presente (varios nulos permitidos).
- C. Obligatorio y único.

**Recomendación:** A en MVP; evaluar B si la calidad de datos es alta. El código interno sigue siendo la identidad.

**Si no se responde:** A.

**Decisión aprobada (2026-11-10):** opción **A** — el número de serie no es único; se advierte y se reporta duplicados.

**Bloquea:** fase 4. **Estado:** aprobada.

---

### D-17 — ¿Se puede dar de baja un extintor que está en mantenimiento?

**Pregunta:** Si un equipo se pierde o se decide retirar mientras está en el taller, ¿se permite la baja directa o se exige primero el retorno?

**Por qué importa:** la baja desde una contraparte externa deja una responsabilidad pendiente con el proveedor. También afecta la orden abierta y la conciliación.

**Opciones:**

- A. Prohibir baja con orden activa; exigir retorno o ajuste administrativo.
- B. Permitir baja desde mantenimiento con documento y cierre de orden.
- C. Permitir baja solo con autorización de `ADMIN` y evidencia.

**Recomendación:** A por defecto; C como excepción documentada.

**Si no se responde:** A.

**Decisión aprobada (2026-11-10):** opción **A** — prohibida la baja con orden de mantenimiento activa; la excepción se resuelve con `AJUSTE` de `ADMIN` y evidencia.

**Bloquea:** fase 6. **Estado:** aprobada.

---

### D-18 — ¿Qué documentos exige el mantenimiento?

**Pregunta:** ¿Se exige documento/guía en el envío, certificado en recarga/prueba hidrostática y acta en el retorno? ¿El costo es obligatorio?

**Por qué importa:** define campos obligatorios y validaciones. No se debe inventar una exigencia legal; debe venir de la política.

**Opciones:**

- A. `document_ref` obligatorio en envío/retorno; certificado opcional pero recomendado.
- B. Certificado obligatorio para recarga y prueba hidrostática.
- C. Sin documentos obligatorios en MVP.

**Recomendación:** A + B si la organización lo exige por política. El costo es opcional.

**Si no se responde:** A; certificado opcional.

**Decisión aprobada (2026-11-10):** opción **A** — `document_ref` obligatorio en envío/retorno **externo**; opcional en servicio interno; certificado opcional pero recomendado.

**Bloquea:** fase 6. **Estado:** aprobada.

---

### D-19 — ¿Qué formatos de reporte se necesitan?

**Pregunta:** ¿Basta consultar en pantalla y exportar CSV, o se requieren PDF/Excel con formato oficial?

**Por qué importa:** PDF/Excel añaden plantillas, librerías y pruebas de formato. CSV cubre la mayoría de necesidades operativas.

**Opciones:**

- A. JSON + CSV en MVP; PDF/Excel en fase 2.
- B. PDF/Excel en MVP.
- C. Solo pantalla en MVP.

**Recomendación:** A.

**Si no se responde:** A.

**Bloquea:** no bloquea MVP. **Estado:** abierta.

---

### D-20 — ¿Qué notificaciones se requieren?

**Pregunta:** ¿Basta mostrar alertas en la app o se requiere correo/WhatsApp/SMS? ¿A quién se notifica?

**Por qué importa:** correo requiere servidor SMTP, plantillas, rebotes, preferencias y pruebas. WhatsApp/SMS requieren proveedor y costo.

**Opciones:**

- A. Solo alertas en la app (MVP).
- B. Correo diario/semanal.
- C. Correo + WhatsApp/SMS.

**Recomendación:** A; B en fase 2.

**Si no se responde:** A.

**Bloquea:** no bloquea MVP. **Estado:** abierta.

---

### D-21 — ¿Cuánto tiempo se conserva el historial y la auditoría?

**Pregunta:** ¿Existe una política de retención legal/organizacional? ¿Se archivan datos antiguos?

**Por qué importa:** afecta respaldos, tamaño de base, consultas y cumplimiento. Por defecto, no se borra nada.

**Opciones:**

- A. Conservación indefinida.
- B. Archivo después de N años (N a definir).
- C. Eliminación/anonimización programada.

**Recomendación:** A en MVP; definir política antes de producción.

**Si no se responde:** A.

**Bloquea:** no bloquea MVP. **Estado:** abierta.

---

### D-22 — ¿Cuál es el volumen esperado?

**Pregunta:** ¿Cuántos extintores, usuarios, movimientos/año y sedes se esperan en 12–24 meses?

**Por qué importa:** dimensiona índices, hardware, respaldos y pruebas de rendimiento.

**Opciones:** el propietario debe dar cifras. Supuesto inicial: 10 000 activos, 100 000 movimientos, <100 usuarios.

**Recomendación:** validar el supuesto; si se supera 10×, revisar particionado/archivo.

**Si no se responde:** se usa el supuesto inicial.

**Bloquea:** no bloquea MVP; rendimiento. **Estado:** abierta.

---

### D-23 — ¿Dónde se despliega y cuál es el objetivo de respaldo?

**Pregunta:** ¿Nube/on-premise? ¿Quién administra MySQL? ¿RPO/RTO aceptables? ¿HTTPS y dominio?

**Por qué importa:** define configuración, backups, monitoreo, costos y seguridad. La cámara requiere HTTPS.

**Opciones:**

- A. Nube administrada con HTTPS y backup diario.
- B. Servidor propio con MySQL local.
- C. Híbrido.

**Recomendación:** A si es posible; documentar restauración y monitoreo. RPO/RTO a confirmar (ej. propuesta: RPO 24 h, RTO 4 h, sujeta a aprobación).

**Si no se responde:** se documenta una instalación local y se deja el despliegue para la fase 11.

**Bloquea:** no bloquea MVP; despliegue. **Estado:** abierta.

---

### D-24 — ¿Hay inventario existente que importar?

**Pregunta:** ¿Existe una planilla, base de datos o etiquetas previas? ¿Cuántos registros? ¿Qué columnas? ¿Quién valida la calidad?

**Por qué importa:** la importación puede ser el mayor riesgo de datos. Requiere mapeo, dry-run, reglas de duplicados y estrategia de códigos.

**Opciones:**

- A. No hay datos previos.
- B. Importación CSV única antes de producción.
- C. Importación recurrente desde otro sistema.

**Recomendación:** B con dry-run y reporte; C solo con API/integración formal.

**Si no se responde:** se asume A; si hay datos, la fase 4 se extiende.

**Decisión aprobada (2026-11-10):** opción **C** — conciliación por sede, usando el listado desactualizado como referencia, verificación física, etiquetado, *dry-run* y reporte de diferencias.

**Bloquea:** fase 4 si aplica. **Estado:** aprobada.

---

### D-25 — ¿Se necesitan movimientos por lote?

**Pregunta:** ¿Se trasladan varios extintores en una misma orden (ej. 50 equipos a una sede)? ¿Se requiere una cabecera de lote?

**Por qué importa:** un modelo de lote agrupa movimientos, pero complica la trazabilidad individual y la corrección. El MVP puede registrar un movimiento por activo.

**Opciones:**

- A. Un movimiento por activo (MVP).
- B. Cabecera de lote + ítems.
- C. Lote solo para la UI, con movimientos individuales.

**Recomendación:** A + C: la UI permite seleccionar varios y confirmar, pero genera un movimiento individual por activo. B en fase 2 si se requiere una orden documental única.

**Si no se responde:** A.

**Bloquea:** no bloquea MVP. **Estado:** abierta.

---

### D-26 — ¿Condición técnica como enum o catálogo administrable?

**Pregunta:** ¿Las cuatro condiciones propuestas son suficientes o la organización necesita agregar valores?

**Por qué importa:** un enum es simple y seguro; un catálogo permite cambios sin migración, pero requiere administración y validación.

**Opciones:**

- A. Enum en MVP.
- B. Catálogo administrable desde el inicio.

**Recomendación:** A; B en fase 2.

**Hecho confirmado (2026-11-12):** los cuatro valores propuestos cubren la operación; no se requieren estados adicionales ni existe otro vocabulario que deba respetarse.

**Decisión aprobada (2026-11-12):** opción **A**. El conjunto es fijo en el MVP:

- `OPERATIVO`, `OBSERVADO`, `NO_OPERATIVO`, `PENDIENTE_INSPECCION`.
- No hay catálogo administrable ni creación de valores desde la aplicación.
- Agregar, quitar o renombrar un valor exige migración, análisis de impacto en reportes y pruebas de regresión.
- El valor siempre es explícito; no se deduce de la ubicación ni del estado logístico (BR-012/BR-013).

**Bloquea:** fase 1/2. **Estado:** aprobada.

**Derivada resuelta — D-26b:** el efecto operativo de cada condición se aprobó el 2026-11-12 (ver la decisión D-26b a continuación).

---

### D-26b — ¿Qué efecto operativo tiene cada condición?

**Pregunta:** ¿La condición técnica bloquea movimientos o solo informa? En particular, ¿puede un extintor `NO_OPERATIVO` instalarse en un área?

**Por qué importa:** define si el sistema impide una asignación insegura o si depende de la disciplina del usuario.

**Opciones:**

- A. Solo informativa; ningún valor bloquea.
- B. `NO_OPERATIVO` bloquea la asignación a áreas; permite almacén, taller y proveedor.
- C. Como B, con excepción forzada por permiso especial.

**Recomendación:** B.

**Decisión aprobada (2026-11-12):** opción **B**.

- `NO_OPERATIVO` no puede ser destino `AREA` ni alta inicial en un área.
- `NO_OPERATIVO` sí puede ubicarse en `ALMACEN`, `TALLER` o proveedor externo, y puede enviarse a mantenimiento.
- `OBSERVADO` y `PENDIENTE_INSPECCION` permiten cualquier ubicación, con advertencia visible.
- La condición no genera alertas por sí misma; las alertas siguen siendo por fechas.
- El bloqueo se valida en el servidor y se cubre con pruebas de integración.
- Si un equipo está `ASIGNADO` en un área y se intenta cambiar a `NO_OPERATIVO`, el cambio se rechaza: primero debe retirarse a almacén o taller mediante el movimiento correspondiente.
- No se crea un permiso de excepción en el MVP; si la operación lo exige, se evalúa en una fase posterior.

**Bloquea:** fase 5. **Estado:** aprobada.

---

### D-27 — ¿Quién puede cambiar la condición técnica?

**Pregunta:** ¿Solo Seguridad, o también Almacén/Administrador? ¿Se exige motivo y evidencia?

**Por qué importa:** la condición técnica determina si un equipo se considera operativo; un cambio no autorizado es un riesgo de seguridad.

**Opciones:**

- A. `SEGURIDAD` + `ADMIN`, con motivo.
- B. Solo `ADMIN`.
- C. `ALMACEN` también, con aprobación.

**Recomendación:** A.

**Decisión aprobada (2026-11-12):** opción **A**.

- Pueden cambiar la condición `SEGURIDAD` y `ADMIN`, con el permiso `extinguishers.condition`.
- `ALMACEN` y `CONSULTA` no pueden; reciben 403 aunque invoquen la API directamente.
- Motivo obligatorio (5–500 caracteres).
- Evidencia documental **opcional** en este endpoint; el certificado o acta se registra en el servicio o la inspección.
- El cambio no altera ubicación ni estado logístico; genera auditoría con valor anterior, valor nuevo, usuario, fecha y motivo.
- `ALMACEN` con aprobación queda fuera del MVP y depende de D-08b.

**Bloquea:** fase 2. **Estado:** aprobada.

---

### D-28 — ¿Una inspección debe cambiar automáticamente la condición técnica?

**Pregunta:** Si una inspección resulta `RECHAZADO`, ¿el equipo pasa automáticamente a `NO_OPERATIVO`?

**Por qué importa:** automatizar puede ser conveniente, pero mezcla el registro de inspección con una decisión técnica. También puede ocultar casos que requieren evaluación.

**Opciones:**

- A. No cambiar automáticamente; acción separada auditada (MVP).
- B. Mapear resultado → condición automáticamente.
- C. Sugerir el cambio y pedir confirmación.

**Recomendación:** A; C en fase 2.

**Decisión aprobada (2026-11-12):** opción **A**.

- La inspección registra resultado y fechas; no modifica `technical_condition`.
- El cambio de condición se hace con `POST /extinguishers/:id/condition` (D-27), con motivo y auditoría.
- La ficha y los reportes muestran el resultado de la última inspección para que la falta de cambio sea visible.
- La regla es la misma que en mantenimiento (D-10): el resultado es evidencia, no una transición automática.
- La sugerencia con confirmación (opción C) queda como mejora posterior.

**Bloquea:** fase 6. **Estado:** aprobada.

---

### D-29 — ¿Se registran costos de mantenimiento?

**Pregunta:** ¿Se requiere costo, moneda, proveedor y reporte de gastos?

**Por qué importa:** añade campos y reportes financieros; no es necesario para la trazabilidad física.

**Opciones:**

- A. Campos opcionales, sin reporte financiero (MVP).
- B. Registro y reporte de costos.
- C. No registrar costos.

**Recomendación:** A.

**Si no se responde:** A.

**Bloquea:** no bloquea MVP. **Estado:** abierta.

---

### D-30 — ¿Idioma y localización?

**Pregunta:** ¿Solo español (Perú) o varios idiomas? ¿Formatos de fecha `dd/mm/aaaa`?

**Por qué importa:** i18n afecta textos, fechas y validaciones. El MVP puede ser español con arquitectura preparada.

**Opciones:**

- A. Español únicamente.
- B. Español + otro idioma desde el inicio.

**Recomendación:** A; dejar claves de traducción preparadas si es barato.

**Si no se responde:** A.

**Bloquea:** no bloquea MVP. **Estado:** abierta.

---

### D-31 — ¿Cómo se representa el taller propio?

**Pregunta:** Si el mantenimiento lo hace un taller de la propia organización, ¿cómo se representa en el modelo: ubicación interna, contraparte externa o servicio sin movimiento?

**Por qué importa:** el modelo original asume proveedor externo (`provider_id` obligatorio, `EN_MANTENIMIENTO` con colocación `EXTERNAL`). Un taller interno no encaja sin cambios.

**Opciones:**

- A. Ubicación interna de tipo `TALLER`; `EN_MANTENIMIENTO` acepta colocación interna o externa.
- B. Contraparte `EXTERNAL_PARTY` de tipo `TALLER` (distorsiona la semántica).
- C. Servicio interno sin movimiento (la ubicación sería falsa).

**Recomendación:** A. Es la única opción que mantiene la ubicación reconstruible desde hechos reales.

**Decisión aprobada (2026-11-10):** opción **A** — taller como ubicación interna `TALLER`, conviviendo con proveedores externos cuando el servicio se terceriza.

**Bloquea:** fase 6 (mantenimiento) y fase 1 (modelo). **Estado:** aprobada.

---

## 4. Supuestos adoptados (no son decisiones aprobadas)

| ID | Supuesto | Documento relacionado |
|---|---|---|
| S-01 | Single-tenant, una organización con varias sedes. | D-01 |
| S-02 | Zona horaria `America/Lima`. | D-15 |
| S-03 | Online solamente; sin offline en MVP. | D-14 |
| S-04 | Auth local (correo + contraseña) con `AuthProvider` desacoplado; JWT + refresh. | D-06 |
| S-05 | Un movimiento por activo; sin cabecera de lote. | D-25 |
| S-06 | Alta en almacén o área interna. | D-03 |
| S-07 | Código generado `EXT-` + 6 dígitos; sin importación de códigos (D-04). | D-04 |
| S-08 | QR con código plano. | D-05 |
| S-09 | Serie opcional y no única. | D-16 |
| S-10 | Solo fecha indicada; sin umbral inicial (D-11). | D-11 |
| S-11 | La inspección no cambia condición automáticamente. | D-28 |
| S-12 | No se permite baja con orden de mantenimiento activa. | D-17 |
| S-13 | Documentos como referencia textual; archivos en fase 2. | D-13 |
| S-14 | 10 000 activos, 100 000 movimientos, <100 usuarios. | D-22 |
| S-15 | Interfaz en español. | D-30 |
| S-16 | Condición técnica como enum en MVP. | D-26 |
| S-17 | Costos opcionales, sin reporte financiero. | D-29 |
| S-18 | Sin notificaciones por correo en MVP. | D-20 |
| S-19 | Retención indefinida por defecto. | D-21 |
| S-20 | Un solo `ADMIN` puede ajustar; Seguridad puede baja/condición. | D-07/D-27 |
| S-21 | El vencimiento del equipo combina fecha documentada y vida útil calculada por tipo; sin datos queda sin fecha. | D-12 |

**Tras las aprobaciones del 2026-11-10 al 2026-11-12**, S-01, S-02, S-04, S-06 a S-12, S-16, S-20 y S-21 pasan a decisiones aprobadas (ver §2.2 y §2.4). S-11 se ajusta: **no** existe mapeo automático de resultado a condición. Siguen como supuesto S-03, S-05, S-13, S-14, S-15, S-17, S-18 y S-19.

---

## 5. Decisiones ya propuestas (pendientes de aprobación formal)

Estas decisiones se usaron para escribir los documentos, pero **no están aprobadas**:

1. Mantener el stack Angular + NestJS + MySQL 8 + Prisma sin cambios.
2. Usar UUID `CHAR(36)` para identificadores.
3. Separar ubicación, estado logístico y condición técnica.
4. Usar una proyección `due_dates` y calcular alertas sin persistir filas duplicadas.
5. Usar `maintenance_orders` + `maintenance_services` en lugar de un único `maintenance_records`.
6. No borrar físicamente historial; corregir con `AJUSTE` o nuevo registro.
7. Usar `row_version` + bloqueo de fila para concurrencia.
8. Usar idempotencia en POST críticos.
9. No implementar `alerts` persistidas en el MVP.
10. No implementar lotes de movimiento en el MVP.

---

## 6. Orden recomendado para responder (una por una)

Para no bloquear el diseño, se propone esta secuencia. Solo figuran las decisiones **abiertas** al 2026-11-12; las aprobadas están en §2.2 y §2.4, y ya se reflejaron en los documentos. Cada respuesta se registra aquí y se refleja en el modelo/API antes de avanzar.

1. **D-08b:** ¿se requiere flujo de aprobación en la aplicación? (fase 5)
2. **D-13:** ¿adjuntos, fotos o firmas en el MVP? (fase 6)
3. **D-19:** ¿qué formatos de reporte se necesitan? (fase 7)
4. **D-20:** ¿qué notificaciones se requieren? (fase 7)
5. **D-21:** ¿cuánto tiempo se conserva el historial y la auditoría? (transversal)
6. **D-22:** ¿cuál es el volumen esperado? (transversal)
7. **D-23:** ¿dónde se despliega y cuál es el objetivo de respaldo? (transversal)
8. **D-14:** ¿se requiere operación sin internet? (transversal)
9. **D-25:** ¿se necesitan movimientos por lote? (fase 5)
10. **D-29:** ¿se registran costos de mantenimiento? (fase 6)
11. **D-30:** ¿idioma y localización? (transversal)

---

## 7. Control de cambios

- Cada decisión aprobada se marca con fecha, responsable y documento afectado.
- Un cambio de decisión después de una migración requiere análisis de impacto, migración de datos y pruebas de regresión.
- Las decisiones que afecten el QR o el código de activo requieren plan de reetiquetado.
- Las decisiones que afecten permisos requieren revisión de seguridad y pruebas 403.
- Las decisiones que afecten fechas/umbrales requieren pruebas de borde y comunicación a los usuarios.

---

## 8. Plantilla para registrar una decisión

```text
ID:
Fecha:
Responsable:
Decisión:
Alternativas descartadas:
Impacto en datos:
Impacto en API:
Impacto en seguridad:
Impacto en pruebas:
Documentos actualizados:
```
