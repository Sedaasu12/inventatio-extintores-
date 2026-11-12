# Instrucciones del proyecto: sistema de inventario y trazabilidad de extintores

## Objetivo
Construir una aplicación web para registrar cada extintor como un activo individual, consultar su ubicación actual, conservar el historial completo de movimientos y controlar inspecciones, mantenimientos, recargas, pruebas y fechas de vencimiento documentadas.

## Reglas de trabajo
- Antes de programar, lee `docs/00-vision-y-alcance.md`, `docs/01-requerimientos.md`, `docs/02-arquitectura.md`, `docs/03-modelo-de-datos.md` y `docs/04-flujos-y-pruebas.md`.
- Carga las skills relevantes: `@extintores-dominio`, `@qr-trazabilidad` y `@entrega-calidad`.
- No empieces a implementar módulos hasta presentar un plan por fases, una lista de decisiones pendientes y criterios de aceptación. Si falta información no bloqueante, registra una suposición explícita; no inventes reglas del negocio.
- Haz preguntas de aclaración de una en una y solo cuando la respuesta cambie de forma importante el diseño o la seguridad de los datos.
- No generes todo el sistema en un solo cambio. Implementa módulos pequeños, verificables y con pruebas.

## Arquitectura objetivo
- Frontend: Angular + TypeScript, diseño responsive y accesible.
- Backend: Node.js + NestJS + TypeScript, API REST.
- Base de datos: MySQL 8.
- Persistencia: Prisma ORM y migraciones versionadas.
- Lectura: cámara del navegador para QR y soporte de lector USB 2D en modo teclado. Mantén entrada manual como alternativa.
- Notificaciones: alertas en la aplicación; correo u otros canales solo en una fase posterior y previa aprobación.

## Reglas de negocio obligatorias
1. Cada extintor es un activo individual con `asset_code` único e inmutable. No se administra únicamente por cantidades agregadas.
2. La ubicación actual debe poder reconstruirse a partir de movimientos confirmados. No permitas modificarla silenciosamente desde un formulario de edición.
3. Toda salida, ingreso, traslado, envío a mantenimiento, retorno o baja debe generar un movimiento auditable con fecha, usuario, origen, destino, responsable, receptor cuando corresponda y motivo.
4. La creación del movimiento y la actualización del estado/ubicación actual deben ejecutarse en una transacción de base de datos.
5. No elimines físicamente movimientos, inspecciones ni servicios confirmados. Corrige mediante un movimiento de reversa/ajuste justificado o un registro correctivo.
6. No permitas trasladar un extintor desde una ubicación distinta de su ubicación/estado actual. Valida el origen antes de confirmar.
7. Separa fechas de vencimiento del equipo, inspección, mantenimiento, recarga y prueba hidrostática. No las mezcles en un único campo `fecha_vencimiento`.
8. Calcula alertas a partir de fechas y umbrales configurables. No inventes periodos reglamentarios ni fechas de próxima atención: deben proceder de política aprobada, certificado, proveedor o responsable autorizado.
9. El QR contiene solo el código estable del activo o una URL estable que lo resuelva; nunca debe contener datos personales, ubicación ni fechas que cambian.
10. Escanear un QR no concede acceso. La ficha y las acciones requieren autenticación y permisos.
11. Las bajas son estados del ciclo de vida, no borrados de la base de datos.
12. Las acciones sensibles deben quedar en un registro de auditoría.

## Calidad y seguridad
- Valida DTOs en el backend; no confíes en validaciones del frontend.
- Usa autorización basada en roles/permisos en servidor.
- Protege contraseñas con un algoritmo de hash apropiado; nunca almacenes texto plano.
- Usa variables de entorno; no incluyas secretos en Git ni en el frontend.
- Evita exponer errores internos o consultas SQL al usuario.
- Usa consultas parametrizadas/ORM, paginación y filtros del lado del servidor.
- Añade índices a códigos, seriales, fechas de alerta, ubicación y claves foráneas.
- Mantén migraciones y datos de prueba reproducibles.
- Escribe pruebas unitarias de reglas críticas, pruebas de integración de transacciones y pruebas E2E de los flujos principales.
- Ejecuta lint, typecheck, pruebas y build después de cada módulo.
- No afirmes que una prueba pasó si no ejecutaste el comando y verificaste su resultado.

## Flujo de implementación obligatorio
1. Inspeccionar el repositorio y reportar su estado; no sobrescribir archivos existentes sin revisarlos.
2. Acordar las decisiones pendientes y el MVP.
3. Diseñar entidades, relaciones, estados, permisos y transiciones.
4. Crear la base de datos y migración inicial.
5. Implementar backend con pruebas.
6. Implementar frontend consumiendo la API real.
7. Implementar lectura QR y alternativa de ingreso manual.
8. Validar casos de aceptación de punta a punta.
9. Documentar instalación, configuración, respaldo y operación.

## Estructura sugerida
- `frontend/`: Angular.
- `backend/`: NestJS.
- `docs/`: requerimientos, decisiones, ERD, API y manuales.
- `.opencode/skills/`: skills del agente.

Adapta la estructura si el repositorio ya tiene una organización válida; documenta cualquier desviación.
