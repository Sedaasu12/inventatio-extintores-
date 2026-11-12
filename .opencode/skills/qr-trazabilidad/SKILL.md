---
name: qr-trazabilidad
description: Diseña e implementa la identificación individual, generación de etiquetas y escaneo QR o código de barras para localizar extintores y registrar movimientos.
compatibility: OpenCode
metadata:
  feature: qr-scanning
---

# Skill: identificación QR y trazabilidad

## Decisión de diseño
Usa un QR único por extintor. El contenido del QR debe ser un identificador estable, por ejemplo `EXT-000125`, o una URL estable que resuelva ese código. Para el MVP se recomienda codificar el identificador y resolverlo dentro de la aplicación autenticada.

No codifiques en el QR la ubicación, el estado, responsable, vencimiento, inspecciones ni datos personales: son valores cambiantes o privados.

## Modos de lectura
1. Cámara del celular desde una vista de escaneo dentro de la aplicación web responsive/PWA.
2. Lector USB 2D configurado como teclado: el lector escribe el contenido en el campo enfocado y envía Enter.
3. Entrada manual del código como alternativa por etiqueta dañada, cámara no disponible o permisos denegados.

La librería de lectura debe estar encapsulada detrás de un servicio Angular para poder cambiar ZXing u otra librería sin modificar la lógica del inventario. Verifica mantenimiento, licencia y compatibilidad al momento de instalar.

## Distinción de hardware
- Un lector 1D convencional lee códigos lineales, no QR.
- Para QR se requiere cámara o lector 2D compatible.
- Antes de comprar hardware, prueba el flujo con cámara y, si ya existe, con el lector disponible.

## Flujo UX
1. Usuario autenticado abre “Escanear”.
2. El navegador solicita permiso de cámara y muestra el visor.
3. Al detectar un código válido, detiene temporalmente el escaneo para evitar lecturas repetidas.
4. El frontend consulta la API para resolver el código.
5. Si existe, muestra ficha, ubicación actual, condición, alertas y acciones permitidas.
6. Si no existe, informa que el código no está registrado; no crea un equipo automáticamente.
7. Para movimiento, abre formulario con el extintor ya seleccionado; solicita tipo, origen/destino, responsables, motivo y documento requerido.
8. El usuario revisa y confirma; el backend valida y registra transacción.
9. La interfaz muestra comprobante/resultado y vuelve a estar lista para escanear.

## Seguridad y robustez
- La lectura no evita el inicio de sesión.
- No expongas información sensible en rutas o QR.
- Valida el código en backend y limita intentos abusivos.
- Maneja código ilegible, duplicado, inexistente, cámara denegada, cámara no disponible y conexión perdida.
- No confirmes un movimiento solo por escanear: exige revisión y confirmación.
- No proceses dos veces la misma lectura o envío por doble clic; usa estado de carga e idempotencia donde aplique.
- Si se evalúa modo sin conexión, diseña una cola sincronizable con conflictos explícitos; no simules éxito cuando no se confirmó en servidor.

## Pruebas
- QR válido y código registrado.
- QR válido pero código inexistente.
- Código de un extintor dado de baja.
- Permiso de cámara denegado.
- Lector USB 2D que escribe el código y Enter.
- Entrada manual.
- Relectura rápida/doble clic.
- Usuario sin permiso de registrar movimientos.
- Error o desconexión de API.
