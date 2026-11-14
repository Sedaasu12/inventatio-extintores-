# Flujos operativos y plan de pruebas

## 1. Alta de extintor
1. Usuario autorizado abre “Nuevo extintor”.
2. Ingresa código (o solicita generación automática), tipo, capacidad, marca/modelo, serie si existe y fechas documentadas.
3. Selecciona ubicación inicial y condición técnica.
4. El backend valida duplicados y campos requeridos.
5. Se crea la ficha y se genera el QR asociado al código estable.
6. Se puede imprimir una etiqueta con QR y código legible.

## 2. Salida de almacén
1. Usuario escanea el QR o busca el código.
2. Sistema muestra equipo y ubicación actual.
3. Usuario elige “Salida” e indica destino, motivo, responsable, receptor y autorización/documento cuando corresponda.
4. El backend valida que el equipo esté en el almacén indicado y que el usuario tenga permiso.
5. Dentro de una transacción se inserta el movimiento y se actualiza ubicación/estado actual.
6. Se muestra confirmación y el movimiento queda en la línea de tiempo.

## 3. Traslado entre áreas
1. Escanear equipo.
2. Seleccionar destino interno.
3. Validar origen actual y permisos.
4. Confirmar y guardar movimiento.
5. Consultar ficha para comprobar ubicación nueva e historial.

## 4. Envío y retorno de mantenimiento
1. Registrar proveedor o taller externo.
2. Escanear extintor y registrar envío, fecha, contraparte, responsable, motivo, documento y retorno previsto si existe.
3. Marcar condición técnica según evaluación autorizada; no asumir que queda operativo.
4. Al retornar, registrar el servicio realizado, resultado, certificado y próxima fecha indicada.
5. Registrar el retorno físico al almacén o área que corresponda.
6. La ubicación y condición deben actualizarse según el flujo autorizado.

## 5. Inspección y alerta
1. Responsable consulta inspecciones próximas/vencidas.
2. Selecciona el extintor y registra inspección, resultado, observaciones y evidencia.
3. Ingresa la próxima fecha indicada por política o responsable autorizado.
4. El sistema calcula estado de alerta sin alterar la fecha fuente.
5. La alerta se resuelve o actualiza al completar el evento correspondiente.

## 6. Casos de prueba mínimos

| Caso | Acción | Resultado esperado |
|---|---|---|
| PT-01 | Crear dos equipos con el mismo código | El segundo se rechaza. |
| PT-02 | Escanear QR registrado | Abre la ficha correcta tras autenticación. |
| PT-03 | Escanear código inexistente | Muestra aviso; no crea equipo. |
| PT-04 | Salir desde el almacén donde está el equipo | Movimiento y ubicación nueva se guardan. |
| PT-05 | Salir desde un origen incorrecto | Rechazo; nada cambia. |
| PT-06 | Fallar la transacción durante el movimiento | No queda movimiento parcial ni ubicación desactualizada. |
| PT-07 | Usuario de consulta intenta registrar salida | API responde sin autorización. |
| PT-08 | Enviar a mantenimiento | Muestra contraparte externa y estado correspondiente. |
| PT-09 | Registrar retorno | Se conserva envío previo, servicio y retorno. |
| PT-10 | Próxima fecha dentro del umbral | Se genera alerta en la categoría correcta. |
| PT-11 | Fecha ya superada | Se marca vencida para esa categoría. |
| PT-12 | Equipo sin fecha documentada ni vida útil calculable | No se inventa fecha; queda indicado como sin configurar (D-12). |
| PT-13 | Dar de baja | Equipo no aparece como operativo, pero conserva historial. |
| PT-14 | Doble clic o lectura duplicada | No se crea movimiento repetido sin control. |
| PT-15 | Cámara denegada | Se ofrece código manual/lector externo. |
| PT-16 | Sin umbral configurado | No aparece “por vencer”; solo vencido, vigente o sin fecha (D-11). |
| PT-17 | Intentar adjuntar un archivo a un movimiento | No existe carga de archivos; solo se acepta referencia textual (D-13). |
| PT-18 | Exportar un reporte a CSV | Descarga con los mismos filtros de la consulta; sin permiso, se rechaza (D-19). |

## 7. Cierre de cada entrega
- Migración ejecutada desde una base vacía.
- Pruebas automatizadas y resultado reportado.
- Frontend y backend compilados.
- Flujo probado en navegador.
- `.env.example` actualizado sin secretos.
- Manual de ejecución local actualizado.
- Limitaciones conocidas documentadas.
