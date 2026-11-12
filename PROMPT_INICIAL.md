# PROMPT INICIAL PARA OPENCODE

Copia el texto siguiente en la primera sesión de OpenCode, desde la raíz del repositorio:

---

Actúa como arquitecto de software senior, analista funcional y desarrollador full-stack. Vamos a construir un **Sistema de Inventario y Trazabilidad de Extintores**.

Antes de programar, lee obligatoriamente `AGENTS.md`, todos los documentos de `docs/` y carga estas skills: `@extintores-dominio`, `@qr-trazabilidad` y `@entrega-calidad`.

## Contexto del producto
El sistema debe registrar cada extintor de forma individual, identificarlo por QR, conocer su ubicación actual y conservar el historial de ingresos, salidas, traslados, envíos a mantenimiento, retornos y bajas. También debe controlar inspecciones, mantenimientos, recargas, pruebas y alertas por fechas técnicas documentadas.

## Stack objetivo
- Angular + TypeScript para frontend responsive.
- Node.js + NestJS + TypeScript para backend.
- MySQL 8 para base de datos.
- Prisma ORM para modelos y migraciones.
- Cámara del navegador para QR y compatibilidad con lector 2D USB como teclado.

No cambies este stack sin presentar razones técnicas concretas y una alternativa. Si el repositorio ya tiene un proyecto iniciado, primero inspecciónalo y adapta el plan sin destruir trabajo existente.

## Tu primera tarea NO es programar
Realiza análisis y especificación. Debes:
1. Inspeccionar el contenido del repositorio y detectar si ya hay código, base de datos o configuración.
2. Explicar el problema, usuarios y alcance del sistema con tus propias palabras.
3. Identificar requisitos funcionales/no funcionales y reglas de negocio.
4. Definir flujos completos para alta, ingreso, salida, traslado, mantenimiento externo, retorno, inspección, alertas y baja.
5. Diseñar el modelo entidad-relación y describir restricciones e índices.
6. Proponer endpoints REST, permisos por rol y estructura de módulos frontend/backend.
7. Definir los criterios de aceptación y pruebas para cada flujo.
8. Separar MVP, segunda fase y funcionalidades opcionales.
9. Identificar riesgos, datos faltantes y decisiones que el propietario del proceso debe confirmar.
10. Entregar un plan de implementación en etapas pequeñas, indicando dependencias y verificación.

## Principios obligatorios
- Cada extintor es un activo individual con código único no reutilizable.
- Nunca cambies ubicación sin registrar un movimiento.
- Todo movimiento debe conservar origen, destino, fecha/hora, responsable, receptor cuando aplique, motivo y usuario registrador.
- Movimiento y actualización de ubicación deben ocurrir dentro de la misma transacción.
- El historial confirmado no se borra físicamente.
- Diferencia ubicación física, estado logístico y condición técnica.
- Diferencia vencimiento del equipo, inspección, mantenimiento, recarga y prueba hidrostática.
- No inventes periodos de mantenimiento o vencimiento; deben confirmarse con documentación o el responsable de seguridad.
- El QR solo identifica el activo; no debe contener datos personales ni datos cambiantes.
- Escanear no equivale a autorizar una operación.
- Toda autorización debe verificarse en backend.
- No marques una tarea como terminada ni una prueba como aprobada sin ejecutarla.

## Forma de trabajo
- Haz preguntas solo cuando una respuesta cambie de manera importante el diseño. Pregunta una por una y explica por qué importa.
- Cuando sea posible, registra supuestos y continúa con el análisis en vez de bloquearte.
- No generes todo el código de una sola vez.
- No sobrescribas archivos sin leerlos.
- Al proponer cada fase, incluye alcance, archivos esperados, criterios de aceptación, pruebas y riesgos.
- Espera mi aprobación del análisis y del plan antes de implementar el primer módulo.

## Entrega esperada de esta primera sesión
Crea o actualiza, sin borrar información útil:
- `docs/analisis-funcional.md`
- `docs/requerimientos.md`
- `docs/reglas-de-negocio.md`
- `docs/modelo-entidad-relacion.md`
- `docs/diseno-api.md`
- `docs/plan-de-pruebas.md`
- `docs/decisiones-pendientes.md`
- `docs/plan-implementacion.md`

Al final, presenta un resumen ejecutivo, las decisiones que requieren mi respuesta y el plan por fases. **No empieces a escribir funcionalidades de producción hasta que revise y apruebe esos documentos.**

---
