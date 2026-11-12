---
name: extintores-dominio
description: Aplica las reglas del negocio, estados, movimientos, mantenimiento, inspecciones y alertas del sistema de inventario de extintores.
compatibility: OpenCode
metadata:
  domain: inventory-traceability
---

# Skill: dominio de inventario y trazabilidad de extintores

Usa estas reglas al analizar requerimientos, diseñar tablas, crear endpoints o implementar pantallas.

## 1. Unidad de control
Cada extintor se controla individualmente. Debe tener un código interno único (ejemplo `EXT-000125`) y una ficha propia. El número de serie del fabricante puede ser opcional, porque puede faltar o repetirse por errores de captura. Si existe, almacénalo y valida duplicados según la política acordada.

Atributos sugeridos: código interno, tipo, agente extintor, capacidad, marca, modelo, número de serie, fecha de fabricación, fecha de adquisición, fecha de puesta en servicio, fecha de vencimiento indicada por fabricante/documentación (si aplica), estado operativo, ubicación actual y observaciones.

No asumas que todos los tipos de extintor comparten las mismas fechas, pruebas o periodos.

## 2. Ubicaciones y entidades externas
Permite una jerarquía configurable, por ejemplo: empresa → sede → edificio → piso → área → punto. El primer MVP puede usar una jerarquía simple sede/área/almacén, pero evita codificar nombres concretos en el programa.

Mantenimiento puede implicar una ubicación externa. Registra proveedor/empresa externa como contraparte del movimiento y conserva la fecha de envío, responsable, documento o constancia y fecha de retorno prevista cuando exista.

## 3. Tipos de movimiento
Como mínimo:
- `INGRESO`: recepción o entrada al almacén.
- `SALIDA`: salida desde almacén hacia una ubicación interna o destino externo.
- `TRASLADO`: cambio de una ubicación interna a otra.
- `ENVIO_MANTENIMIENTO`: entrega a proveedor o taller externo.
- `RETORNO_MANTENIMIENTO`: retorno luego del servicio.
- `RETORNO_ALMACEN`: devolución desde una sede/área al almacén.
- `BAJA`: retiro definitivo del inventario operativo, con autorización y motivo.
- `AJUSTE`: corrección excepcional, justificada y auditada.

Conserva la fecha/hora, activo, tipo, origen, destino, contraparte externa si aplica, solicitante, autorizado por, entregado por, recibido por, motivo, documento relacionado, notas y usuario que registró.

## 4. Estado y ubicación actual
Modela por separado:
- ubicación física actual (ubicación interna o entidad externa/con contraparte);
- estado logístico (en almacén, instalado/asignado, en tránsito si se necesita, en mantenimiento, dado de baja);
- condición técnica (operativo, observado, no operativo, pendiente de inspección u otros definidos por responsable).

No uses un único campo ambiguo para los tres conceptos. Define las transiciones permitidas y valídalas en backend. El estado actual debe actualizarse en la misma transacción que inserta el movimiento.

## 5. Fechas y mantenimiento
Distingue al menos:
- vencimiento o vida útil límite, solo cuando esté documentado;
- próxima inspección;
- próximo mantenimiento;
- próxima recarga, cuando corresponda;
- próxima prueba hidrostática, cuando corresponda.

Cada inspección/servicio debe guardar tipo, fecha realizada, resultado, ejecutor/proveedor, documento o certificado, próxima fecha indicada y observaciones. El intervalo puede ser configurable por tipo de equipo/política, sujeto a validación por el responsable de seguridad. No generes fechas basadas en suposiciones.

Las alertas son independientes por tipo de fecha: `VENCIDO`, `POR_VENCER`, `VIGENTE` y, cuando no exista fecha documentada, `SIN_FECHA_CONFIGURADA`. El umbral de “por vencer” debe ser configurable.

## 6. Usuarios y permisos sugeridos
- Administrador: configuración, usuarios, catálogos y acceso completo.
- Encargado de almacén: activos, ingresos, salidas y traslados autorizados.
- Responsable de seguridad: inspecciones, servicios, revisión de alertas y reportes.
- Consulta/auditor: lectura de fichas, movimientos e informes, sin alterar datos.

Los nombres y permisos definitivos se validan con el usuario. Aplica siempre autorización en backend.

## 7. Informes esenciales
- inventario total y por condición;
- equipos por ubicación/sede/área;
- equipos en almacén;
- equipos fuera de almacén;
- equipos enviados a mantenimiento y retornos pendientes;
- movimientos por periodo, usuario, tipo y ubicación;
- inspecciones y servicios próximos/vencidos;
- equipos sin ubicación o con información incompleta;
- bajas y ajustes con motivos.

## 8. Validaciones críticas
- Código único y no reutilizable.
- No permitir movimiento de un equipo dado de baja salvo procedimiento de reversión autorizado.
- El origen del movimiento debe coincidir con el estado/ubicación vigente.
- No confirmar un retorno de mantenimiento sin indicar resultado del servicio y contraparte/proveedor.
- No permitir fechas imposibles sin advertencia y confirmación autorizada.
- Movimientos e historial técnico confirmados no se borran físicamente.
- Toda corrección debe guardar quién, cuándo y por qué.
