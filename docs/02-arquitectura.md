# Arquitectura y decisiones técnicas

## 1. Arquitectura recomendada
Aplicación web de tres capas:

- Angular: interfaz responsive y PWA opcional.
- NestJS: API REST, autenticación, reglas de negocio, validaciones, alertas y reportes.
- MySQL 8: persistencia relacional.
- Prisma ORM: modelos, consultas y migraciones.

El frontend nunca se conecta directamente a MySQL. Toda operación pasa por la API.

## 2. Módulos del backend
- `auth`: inicio de sesión, sesiones/tokens y protección de rutas.
- `users`: usuarios, roles y permisos.
- `locations`: sedes, almacenes y áreas.
- `extinguishers`: catálogo y fichas individuales.
- `movements`: ingresos, salidas, traslados, mantenimientos externos, retornos y bajas.
- `inspections`: inspecciones periódicas y resultados.
- `maintenance`: mantenimiento, recarga, reparación y pruebas.
- `alerts`: reglas y alertas por fecha.
- `reports`: consultas agregadas y exportaciones.
- `audit`: registro de cambios críticos.

## 3. Módulos del frontend
- Login.
- Dashboard.
- Inventario de extintores y ficha de detalle.
- Formulario de registro/edición.
- Escáner QR.
- Registro de movimiento.
- Ubicaciones.
- Inspecciones y servicios técnicos.
- Alertas.
- Reportes.
- Administración de usuarios y catálogos.

## 4. Decisión QR / código de barras
Recomendación inicial: QR, porque permite lectura con cámara de celular y lectores 2D. Cada etiqueta debe mostrar también el código textual (p. ej., `EXT-000125`) para que se pueda escribir manualmente.

El QR debe contener un código estable o una URL estable, no una copia de la ficha. Los datos mutables se consultan en el backend. No incluir información de ubicación, fechas o datos personales en la etiqueta.

La cámara puede implementarse mediante una librería compatible con el navegador (por ejemplo, ZXing para browser), encapsulada en un servicio Angular. Un lector USB que emula teclado puede integrarse con un campo de entrada. Para leer QR se necesita cámara o lector 2D; un lector 1D solo no será suficiente.

## 5. Modelo de estados
Mantener conceptos separados:
- Estado logístico: `EN_ALMACEN`, `ASIGNADO`, `EN_MANTENIMIENTO`, `EN_TRANSITO` (solo si el proceso lo requiere), `DADO_DE_BAJA`.
- Condición técnica: `OPERATIVO`, `OBSERVADO`, `NO_OPERATIVO`, `PENDIENTE_INSPECCION` (catálogo ajustable).
- Ubicación: ubicación interna actual o contraparte externa.

No confundir “ubicación” con “condición técnica”. Un extintor podría estar en un área y estar observado, por ejemplo.

## 6. Seguridad
- Autenticación segura y contraseñas con hash.
- Autorización por roles en servidor.
- Validación de payloads/DTOs.
- CORS restringido a dominios permitidos en producción.
- Protección de secretos mediante variables de entorno.
- HTTPS en despliegue.
- Registro de acciones sensibles.
- Rate limiting en autenticación y resolución de códigos.
- Backups diarios cifrados y procedimiento de restauración probado (D-23).

## 7. Alertas
Las alertas se calculan al consultar, desde las fechas objetivo (`due_dates`) y los umbrales configurados (`alert_settings`); no se persisten filas duplicadas ni se requiere un job que las genere (D-11). El umbral de aviso es configurable por tipo de evento; 30 días es solo un ejemplo de configuración, no una norma universal. Sin umbral configurado no se genera `POR_VENCER` (D-11).

Las alertas se muestran solo dentro de la aplicación (dashboard, ficha y reportes); el MVP no envía correo, WhatsApp ni SMS (D-20).

Cada alerta muestra: extintor, ubicación, categoría de fecha, fecha objetivo, días restantes/atraso y responsable sugerido.

## 8. Decisiones de implementación
- API REST con versionado inicial `/api/v1`.
- Fechas en base de datos en tipo adecuado; define y documenta zona horaria. Mostrar en hora local de la organización.
- Paginación y filtros del lado del servidor.
- Transacciones al registrar movimientos.
- Migraciones de Prisma versionadas y ejecutadas en orden.
- Docker Compose puede ser opcional para desarrollo; el proyecto también debe documentar una instalación local de MySQL para no depender del uso de contenedores.

## 9. Despliegue y respaldo (D-23)

- **Aplicación y API en nube**, servidas por HTTPS con dominio propio; el navegador exige contexto seguro para la cámara.
- **MySQL en un servidor de la organización** (on-premise), administrado por la organización y sin exposición directa a Internet.
- La API se conecta a MySQL por red privada o túnel cifrado; las credenciales se inyectan por variables de entorno y no se versionan.
- **Respaldo:** copia completa diaria, cifrada, con retención definida por el responsable de operación; prueba de restauración antes de producción y al menos trimestral.
- **RPO 24 h / RTO 4 h:** se acepta perder hasta un día de movimientos; la recuperación objetivo es de cuatro horas.
- Monitoreo de API, conexión a MySQL y resultado del respaldo; alertas al responsable de operación.
