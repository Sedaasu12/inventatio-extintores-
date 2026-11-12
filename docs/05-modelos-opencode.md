# Uso de DeepSeek y modelos gratuitos en OpenCode

**Verificado el 10 de noviembre de 2026.** Los modelos y sus condiciones pueden cambiar; usa el selector real de OpenCode en lugar de fijar un identificador antiguo en la configuración del proyecto.

## 1. Regla general
OpenCode permite conectar proveedores y seleccionar modelos con `/connect` y `/models`. El catálogo visible depende del proveedor conectado, la cuenta y los modelos disponibles para el proyecto. Los modelos gratuitos de OpenCode no significan que todos los modelos DeepSeek o todas las API sean gratuitos.

## 2. Flujo recomendado
1. Inicia OpenCode en la raíz del repositorio.
2. Ejecuta `/connect` y conecta el proveedor que vayas a utilizar.
3. Ejecuta `/models` y revisa los modelos disponibles en esa sesión.
4. Para trabajar sin costo de API, selecciona solo un modelo que el catálogo marque como gratuito/no facturable y comprueba que puede usar herramientas, leer archivos y ejecutar comandos.
5. Para tareas complejas, puedes conectar DeepSeek directamente y revisar el precio vigente antes de consumir la API.

## 3. DeepSeek directo
La documentación oficial consultada muestra `deepseek-flash` (DeepSeek-V4.1-Flash-1017, actualización del 17 de octubre de 2026) y `deepseek-v4-pro`. La API cobra por tokens de entrada/salida y publica tarifas por millón de tokens; por tanto, **no se debe tratar la API directa como gratuita**. Los nombres heredados `deepseek-chat` y `deepseek-reasoner` fueron retirados según el registro oficial de cambios; no los fijes en configuraciones nuevas.

Comprueba siempre la página oficial de modelos y precios y el selector `/models` antes de configurar.

## 4. Cómo repartir el trabajo
- Modelo gratuito disponible: aclarar requerimientos, resumir archivos, generar documentación, proponer pantallas sencillas y revisar tareas pequeñas.
- DeepSeek Flash u otro modelo con buen uso de herramientas: implementar módulos habituales, generar pruebas y revisar errores.
- Modelo de razonamiento/coding más fuerte disponible: revisar transacciones, reglas de negocio, migraciones complejas, seguridad y errores difíciles.

No asumas que el modelo con el nombre más grande es necesariamente el mejor para OpenCode. Prioriza soporte de herramientas, edición de archivos y consistencia del agente.

## 5. No guardar claves en el repositorio
- Usa el flujo seguro `/connect` cuando esté disponible.
- Si configuras variables, utiliza `.env` local y agrega `.env` a `.gitignore`.
- Publica solo `.env.example` con valores ficticios.
- Nunca pegues una clave API en `AGENTS.md`, una skill, el prompt o código fuente.

## Fuentes oficiales
- OpenCode proveedores: https://opencode.ai/docs/providers/
- OpenCode modelos: https://opencode.ai/docs/models/
- OpenCode skills: https://opencode.ai/docs/skills/
- DeepSeek API change log: https://api-docs.deepseek.com/updates/
- DeepSeek modelos y precios: https://api-docs.deepseek.com/quick_start/pricing/
