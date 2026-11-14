# Requerimientos iniciales

## 1. Requerimientos funcionales

| ID | Requerimiento | Prioridad |
|---|---|---|
| RF-01 | Iniciar sesión y cerrar sesión de forma segura. | Must |
| RF-02 | Administrar usuarios, roles y permisos. | Must |
| RF-03 | Registrar, editar y consultar la ficha individual de cada extintor. | Must |
| RF-04 | Generar código interno único y etiqueta QR para cada extintor. | Must |
| RF-05 | Administrar sedes, almacenes, áreas y ubicaciones. | Must |
| RF-06 | Registrar ingreso al almacén. | Must |
| RF-07 | Registrar salida de almacén indicando destino, motivo, responsable y receptor. | Must |
| RF-08 | Registrar traslado entre ubicaciones. | Must |
| RF-09 | Registrar envío a proveedor/taller de mantenimiento y su retorno. | Must |
| RF-10 | Consultar la ubicación y condición actual de un extintor. | Must |
| RF-11 | Consultar historial cronológico de movimientos por equipo. | Must |
| RF-12 | Registrar inspecciones y sus resultados. | Must |
| RF-13 | Registrar mantenimiento, recarga, reparación y prueba hidrostática cuando corresponda. | Must |
| RF-14 | Registrar documentos/certificados y próxima fecha indicada. | Should |
| RF-15 | Generar alertas por fechas próximas y vencidas, por categoría independiente. | Must |
| RF-16 | Mostrar dashboard con cantidades por ubicación, estado y alertas. | Should |
| RF-17 | Buscar y filtrar por código, serie, tipo, ubicación, condición y fechas. | Must |
| RF-18 | Emitir reportes de inventario, movimientos, inspecciones y servicios. | Should |
| RF-19 | Exportar reportes a Excel/PDF. | Could |
| RF-20 | Registrar auditoría de cambios relevantes. | Must |
| RF-21 | Permitir lectura QR desde cámara del navegador. | Must |
| RF-22 | Permitir ingreso manual y lector USB 2D en modo teclado. | Should |
| RF-23 | Registrar baja con motivo, fecha y autorización. | Must |
| RF-24 | Adjuntar fotos, actas o constancias a movimientos y servicios. | Could | Fuera del MVP: solo referencia textual (D-13); archivos en fase posterior. |

## 2. Requerimientos no funcionales
- RNF-01 Seguridad: autenticación, autorización por rol y validación en backend.
- RNF-02 Integridad: movimientos y actualización de ubicación en una única transacción.
- RNF-03 Trazabilidad: historial no editable silenciosamente; toda corrección debe quedar auditada.
- RNF-04 Usabilidad: interfaz responsive para PC, tablet y celular.
- RNF-05 Rendimiento: búsqueda paginada y filtros en servidor; índices adecuados.
- RNF-06 Disponibilidad: manejo claro de errores de red y del lector/cámara.
- RNF-07 Mantenibilidad: módulos separados, migraciones versionadas y documentación de instalación.
- RNF-08 Respaldo: procedimiento probado de copia y restauración de la base de datos.
- RNF-09 Privacidad: QR sin datos personales ni atributos sensibles; acceso protegido.
- RNF-10 Calidad: pruebas unitarias, integración y E2E para flujos críticos.

## 3. Reglas de negocio
- RN-01 Un extintor es un activo individual; su código no se reutiliza.
- RN-02 Todo cambio físico de ubicación debe generar un movimiento.
- RN-03 El origen indicado debe coincidir con la ubicación/estado vigente.
- RN-04 Confirmar movimiento y actualizar ubicación/estado se realiza de forma atómica.
- RN-05 No se eliminan movimientos confirmados; las correcciones se documentan.
- RN-06 Un extintor dado de baja no participa en movimientos ordinarios.
- RN-07 Las fechas de vencimiento, inspección, mantenimiento, recarga y prueba se almacenan separadamente.
- RN-08 Las alertas usan umbrales configurables; no se inventan periodos técnicos ni se calculan intervalos de próxima fecha (D-11).
- RN-09 Cada movimiento registra usuario creador y sello de tiempo del servidor.
- RN-10 La lectura de QR no reemplaza autenticación ni autorización.

## 4. Criterios de aceptación principales
- CA-01 Al registrar un extintor se genera un código único y una etiqueta QR que permite recuperar su ficha autenticada.
- CA-02 Al registrar una salida, el equipo deja de aparecer en el almacén de origen y aparece en destino, sin perder el historial.
- CA-03 Al consultar un equipo se observa la ubicación actual y todos los movimientos ordenados por fecha.
- CA-04 Si se intenta mover desde un origen que no coincide con la ubicación vigente, el backend rechaza la operación y no cambia datos.
- CA-05 Si falla la inserción del movimiento, tampoco cambia la ubicación actual.
- CA-06 El envío a mantenimiento queda identificado como ubicación/contraparte externa y puede controlarse el retorno.
- CA-07 Las alertas distinguen la categoría técnica y muestran la fecha de la que provienen.
- CA-08 Un usuario sin permiso no puede ejecutar movimientos aunque invoque directamente la API.
- CA-09 El historial confirmado no puede borrarse desde la interfaz.
- CA-10 El sistema permite registrar/consultar manualmente si no se dispone de cámara o lector.

## 5. Priorización del MVP
**MVP obligatorio:** autenticación/roles, ubicaciones, ficha individual, QR, movimientos, historial, inspecciones/servicios básicos, alertas en pantalla y dashboard simple.

**Siguiente iteración:** adjuntos, exportaciones, reportes avanzados, correo, modo PWA mejorado y auditoría ampliada.

**Fase opcional:** modo offline y sincronización, integración con otros sistemas y app móvil nativa.
