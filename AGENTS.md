# AGENTS.md

## Contexto del proyecto

Este proyecto usa Next.js, TypeScript y Tailwind CSS. Debe mantenerse ultra liviano,
rápido y con el menor JavaScript posible en el cliente.

## Gestión del trabajo

GitHub Projects es la fuente de verdad del trabajo de este repositorio.

- Toda tarea, bug, mejora o decisión de alcance debe tener un issue en GitHub y estar vinculada al Project antes de implementarse.
- Mantener en el issue el contexto, criterios de aceptación y decisiones relevantes; no usar listas locales o herramientas externas como backlog principal.
- Mover la tarjeta por los estados del Project durante el trabajo: backlog, lista, en progreso, revisión y terminado, según los estados configurados.
- Los pull requests deben enlazar el issue correspondiente y describir cómo cumplen sus criterios de aceptación.
- Al cerrar una tarea, actualizar el issue y la tarjeta del Project, incluyendo la verificación realizada.
- Si aún no existe un Project para el repositorio, crear o configurar uno en el mismo GitHub antes de iniciar trabajo planificado.

## Reglas de rendimiento obligatorias

- Preferir Server Components; usar `"use client"` solo cuando sea estrictamente necesario.
- Evitar dependencias nuevas. Antes de agregar una, justificar su impacto en el bundle.
- Preferir HTML/CSS y APIs nativas sobre librerías para interacciones simples.
- No cargar fuentes, iconos, imágenes ni scripts de terceros sin una razón explícita.
- Optimizar imágenes con `next/image`, dimensiones declaradas y formatos modernos.
- Mantener Tailwind purgando correctamente las clases no utilizadas; no usar estilos globales
  innecesarios.
- Evitar layouts que provoquen CLS: reservar espacio para imágenes, fuentes y contenido async.
- No introducir estado pesado en el cliente, polyfills o código duplicado.
- Revisar el bundle y el tamaño de las rutas cuando una modificación afecte la UI.

## Test de Lighthouse

Todo cambio relevante debe verificarse sobre una build de producción, nunca únicamente sobre
`next dev`.

```bash
npm run build
npm run start
npx lighthouse http://localhost:3000 \
  --output=html \
  --output-path=./.lighthouse/report.html \
  --chrome-flags="--headless --no-sandbox" \
  --quiet
```

Si el proyecto incorpora Lighthouse CI, usar además:

```bash
npx lhci autorun
```

### Presupuesto mínimo esperado

- Performance: `>= 95`
- Accessibility: `>= 95`
- Best Practices: `>= 95`
- SEO: `>= 95`
- First Contentful Paint: `< 1.8 s`
- Largest Contentful Paint: `< 2.5 s`
- Cumulative Layout Shift: `< 0.1`
- Total Blocking Time: `< 200 ms`
- JavaScript transferido en la carga inicial: `< 100 kB` comprimido cuando sea viable

Un test que no alcance estos objetivos debe reportar la métrica afectada, la causa probable y
la justificación si no es posible corregirla en el mismo cambio. No bajar los presupuestos para
ocultar una regresión.

## Criterio de entrega

Antes de entregar:

1. Ejecutar lint, typecheck y tests disponibles.
2. Ejecutar `npm run build` y validar la ruta modificada con Lighthouse en producción.
3. Comparar el resultado con la ejecución anterior cuando exista un reporte.
4. Informar cualquier dependencia, recurso externo o aumento relevante del bundle.

Los reportes generados localmente deben quedar ignorados por Git; no subir `.lighthouse/` ni
artefactos temporales.
