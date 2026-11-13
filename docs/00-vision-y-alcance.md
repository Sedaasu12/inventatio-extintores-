# Visión y alcance del sistema

## 1. Nombre provisional
Sistema de Inventario y Trazabilidad de Extintores (SITE).

## 2. Problema que resuelve
El inventario tradicional puede mostrar cantidades, pero no necesariamente permite conocer el recorrido de cada extintor: desde qué almacén salió, a qué sede o área llegó, quién lo entregó, quién lo recibió, cuándo fue enviado a mantenimiento y si regresó. También puede ser difícil identificar qué equipos requieren inspección o servicio.

El sistema debe convertir cada extintor en un activo identificable y conservar una línea de tiempo verificable de sus movimientos y eventos técnicos.

## 3. Objetivo general
Desarrollar una aplicación web que permita registrar y controlar individualmente los extintores, conocer su ubicación y condición actual, mantener la trazabilidad de entradas/salidas/traslados y programar alertas relacionadas con fechas técnicas documentadas.

## 4. Objetivos específicos
- Registrar cada extintor con código único y ficha técnica.
- Organizar sedes, almacenes, taller y áreas.
- Registrar ingresos, salidas, traslados, envíos a mantenimiento, retornos y bajas.
- Consultar el historial cronológico de cada activo.
- Identificar equipos mediante QR, con cámara o lector 2D.
- Registrar inspecciones, mantenimientos, recargas y pruebas con sus documentos.
- Mostrar alertas separadas según el tipo de fecha y umbrales configurables.
- Emitir reportes de inventario, movimientos, ubicación y atención técnica.

## 5. Usuarios propuestos
- Administrador del sistema.
- Encargado de almacén.
- Responsable de seguridad/mantenimiento.
- Usuario de consulta o auditor.

Los roles y permisos finales deben ser validados por la organización.

## 6. Suposiciones iniciales por confirmar
1. La primera versión será para una organización, pero podrá administrar varias sedes y áreas.
2. Cada extintor será controlado como unidad individual; no se registrará solamente “20 extintores” como una cantidad agregada.
3. La primera versión funcionará con conexión al servidor. El modo offline se evaluará después si el lugar de operación lo exige.
4. La cámara de un celular será el método inicial de escaneo; el lector 2D será compatible, pero no obligatorio para empezar.
5. Se usarán alertas dentro del sistema. Correo, WhatsApp o SMS se dejan para una fase posterior.
6. Las fechas y frecuencias técnicas procederán de documentos, fabricante, proveedor o responsable autorizado. No se inventarán intervalos.

## 7. Fuera del MVP
- Diagnóstico técnico automático del estado del extintor.
- Sustituir certificados, inspecciones profesionales o procedimientos de seguridad.
- Venta o compra de extintores.
- Aplicación móvil nativa independiente.
- Integración con WhatsApp/SMS.
- Operación offline con sincronización, hasta que se confirme su necesidad.

## 8. Decisiones que la organización debe confirmar
- Sedes y estructura de ubicaciones reales.
- Quién autoriza cada clase de movimiento.
- Tipos de extintor y campos técnicos obligatorios.
- Qué fecha considera “vencimiento” la organización y de qué documento procede (resuelto en D-12: fecha documentada del fabricante + vida útil calculada por tipo, con la más temprana como fecha objetivo).
- Umbral para alertar “por vencer” por cada tipo de evento.
- Si los proveedores externos de mantenimiento deben tener ficha propia.
- Si se exige operación sin internet en almacenes o sedes.
- Si se requiere firma, foto o documento adjunto como evidencia de entrega/recepción.
