---
name: entrega-calidad
description: Obliga a planificar, implementar por etapas, probar, documentar y verificar cada entrega del sistema de extintores.
compatibility: OpenCode
metadata:
  workflow: engineering-quality
---

# Skill: desarrollo por fases y verificación

## Antes de modificar archivos
- Inspecciona el repositorio, stack, versiones, scripts, variables, migraciones y pruebas existentes.
- Resume qué existe, qué falta y qué puede romperse.
- Propón una fase pequeña y define criterios de aceptación verificables.
- Nunca reescribas el proyecto completo ni reemplaces configuración sin explicar el motivo.

## Durante el desarrollo
- Divide el trabajo por módulo vertical: base de datos → backend → frontend → pruebas.
- Mantén tipos compartidos/contratos claros y respuestas API consistentes.
- No simules datos de producción en servicios reales; las semillas de desarrollo deben identificarse como tales.
- No dejes botones o acciones de interfaz sin implementación.
- Para operaciones críticas, prueba tanto resultado correcto como rechazo por regla de negocio.

## Verificación al cerrar una fase
Ejecuta los comandos disponibles en el repositorio, por ejemplo:
- backend: lint, typecheck, unit tests, integration tests y build;
- frontend: lint, typecheck, unit tests y build;
- base de datos: validar migración desde cero y reinicio con datos de prueba;
- E2E: alta de extintor, impresión/lectura QR, salida, traslado, envío/retorno de mantenimiento, alerta y baja.

Si un comando no existe, dilo y sugiere incorporarlo; no afirmes que está aprobado.

## Formato de entrega
Al finalizar cada fase informa:
1. Archivos/módulos creados o modificados.
2. Reglas de negocio implementadas.
3. Comandos ejecutados y resultados reales.
4. Pruebas pendientes o limitaciones.
5. Siguiente fase recomendada.

## Protección de datos
Nunca incluyas contraseñas, claves API, tokens o datos personales reales en el código, fixtures públicos, capturas o documentación. Usa `.env.example` con nombres de variables y valores ficticios.
