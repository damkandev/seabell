# Diseño de Seabell

Este documento define el lenguaje visual de Seabell para la próxima evolución de
la aplicación. Adapta la dirección editorial y técnica de Kerokero a un
workspace de lectura, anotación y organización documental. La fuente de verdad
ejecutable seguirá siendo `apps/web/src/app/globals.css` y los componentes de
`apps/web/src/components`.

La interfaz actual es funcional, pero todavía plana: usa Geist, superficies
neutras y los valores por defecto de shadcn/Tailwind. La aplicación de este
documento será una fase posterior y debe cambiar la jerarquía, las tipografías,
la materialidad y la composición completa, no solo el color.

## 1. Dirección de diseño

Seabell combina dos registros:

- **Editorial:** títulos serif con carácter, ritmo pausado y espacios que ayuden
  a orientarse dentro de un expediente.
- **Técnico:** tipografía monoespaciada, pestañas, bordes, árboles, páginas,
  metadatos y referencias legales precisas.

El resultado debe sentirse como una mesa de trabajo documental: cálida,
concentrada y confiable. No debe parecer una landing de SaaS ni un dashboard
oscuro. La interfaz puede usar recursos de papel, planilla y archivo, pero cada
recurso debe ayudar a leer, ordenar o revisar.

### Principios

1. **El documento antes que la herramienta.** El PDF, la selección y la
   decisión de trabajo son el foco; los controles permanecen disponibles sin
   competir con el contenido.
2. **Estructura visible.** Bordes, pestañas, columnas y jerarquías hacen
   evidente dónde está el usuario y qué afecta cada acción.
3. **Calma con precisión.** Serif para títulos y estados humanos; sans para
   lectura funcional; mono para acciones, metadatos, páginas y referencias.
4. **Materialidad contenida.** Sombras cortas y estados presionados pueden
   recordar papel y fichas, sin convertir cada control en una tarjeta flotante.
5. **Local-first visible.** El diseño debe comunicar que los PDFs viven en el
   navegador y que exportar un `.abn` es una salida clara y controlable.
6. **Movimiento con propósito.** Animar respuesta, orientación o cambio de
   estado; nunca ocultar el contenido detrás de una animación.
7. **Ligereza.** Mantener el runtime sin recursos externos, dependencias nuevas
   ni JavaScript de presentación innecesario.

## 2. Fundamentos visuales

### Color

Los tokens propuestos usan el prefijo `--sb-*` y deben exponerse a Tailwind
mediante `@theme inline`. La base parte del verde existente en `public/logo.svg`
y de la paleta cálida de Kerokero, pero la aplicación la usa como acento de
trabajo, no como superficie dominante.

| Rol | Token | Valor de referencia | Uso |
| --- | --- | --- | --- |
| Lienzo | `--sb-color-canvas` | `#f4fff4` | Fondo de la aplicación y áreas de trabajo |
| Superficie | `--sb-color-surface` | `#ffffff` | Paneles, páginas y controles secundarios |
| Superficie suave | `--sb-color-surface-muted` | `#f7f7f7` | Barra de pestañas, hover y estados neutros |
| Superficie presionada | `--sb-color-surface-pressed` | `#eeeeee` | Active y selección neutra |
| Texto | `--sb-color-text` | `#121b11` | Lectura y contenido general |
| Texto fuerte | `--sb-color-text-strong` | `#0f1e0f` | Títulos, documentos y acciones principales |
| Texto secundario | `--sb-color-text-muted` | `rgba(18, 27, 17, 0.7)` | Metadatos, ayudas y estados pasivos |
| Marca | `--sb-color-brand` | `#b8ffba` | Acción primaria y selección destacada |
| Marca hover | `--sb-color-brand-hover` | `#aefeaf` | Hover de acción primaria |
| Marca active | `--sb-color-brand-pressed` | `#9ff4a1` | Active de acción primaria |
| Texto de marca | `--sb-color-brand-text` | `#304d31` | Texto sobre verde de marca |
| Encabezados | `--sb-color-heading` | `#355133` | Títulos, iconos y diagramas |
| Logotipo | `--sb-color-logo` | `#598a56` | Icono y wordmark de Seabell |
| Borde | `--sb-color-border` | `#d4ddd4` | Separadores, celdas y controles |
| Borde fuerte | `--sb-color-border-strong` | `#93c492` | Pestaña activa, módulos y foco de documento |
| Foco | `--sb-color-focus` | `#316238` | Foco de teclado y selección accesible |

Reglas de uso:

- El verde brillante se reserva para acciones, selección y confirmaciones.
- El cuerpo usa verde-negro en vez de negro puro.
- La jerarquía secundaria usa opacidad antes que una colección de colores nuevos.
- Amarillo, verde, azul, rosa y lila pueden distinguir destacados del PDF; la
  leyenda o el nombre del color siempre acompaña a la señal cromática.
- Rojo queda reservado para errores, eliminación y estados destructivos.
- La lectura del PDF y del editor conserva superficies claras y opacas; no usar
  transparencias o blur detrás de texto largo.
- El tema oscuro no es parte de esta fase. Si se agrega, debe mantener el mismo
  contraste y no convertirse en la identidad principal.

### Tipografía

La nueva interfaz debe cargar las fuentes localmente desde
`apps/web/public/fonts/`, con `font-display: swap`. No incorporar una fuente
remota desde `next/font/google`.

| Rol | Familia | Pesos | Uso |
| --- | --- | --- | --- |
| Títulos | Averia Serif Libre | 400, 700 | `h1`, `h2`, encabezados de vistas, estados vacíos y títulos de expediente |
| Interfaz | Lilex | 400, 500, 600, 700 | Navegación, formularios, menús, descripciones y lectura funcional |
| Técnica | IBM Plex Mono | 400, 600 | Botones, pestañas, páginas, metadatos, leyes, tablas y nombres técnicos |
| Marca | Unbounded | 400 | Wordmark `Seabell`, si se presenta junto al icono |

La marca gráfica existente continúa siendo `apps/web/public/logo.svg`; no
reemplazarla por texto. El wordmark solo aparece cuando el espacio y la
jerarquía lo justifiquen.

Escala de referencia:

- **Título de vista:** `clamp(2rem, 4vw, 3rem)`, line-height entre `0.95` y `1`.
- **Título de expediente o documento:** `1.5rem–2.25rem`, serif.
- **Título de panel:** `1rem–1.25rem`, sans con peso 600.
- **Texto funcional:** `14px–15px`, line-height `1.45–1.65`.
- **Texto compacto:** `12px–13px` en menús y paneles densos.
- **Metadato:** `10px–12px`, mono, preferentemente en mayúsculas y con
  `letter-spacing: 0.08–0.12em`.
- **Contenido legal:** sans o serif legible, nunca mono como cuerpo completo;
  line-height mínimo `1.6`.

Los títulos deben marcar el cambio de contexto. La interfaz operativa no debe
usar serif en cada elemento, porque perdería su función editorial.

### Bordes, radios y sombras

- El borde estándar es de `1px`.
- Las divisiones principales usan bordes horizontales o verticales continuos.
- Los controles mantienen radios pequeños: `6px` como referencia.
- Las tarjetas de documentos pueden usar `8px–12px`; no usar radios tipo pill
  salvo para indicadores que realmente sean etiquetas.
- Los módulos importantes pueden usar sombra sólida desplazada de `4–6px`, con
  borde visible. Las vistas del PDF y del editor no deben parecer flotantes.
- La sombra debe ser corta y legible; evitar elevación difusa y glassmorphism.

### Textura y patrones

Se permiten tres capas, siempre con baja intensidad:

- **Papel:** textura local global entre `8%` y `12%` de opacidad en home,
  autenticación y superficies editoriales.
- **Grilla:** líneas sutiles cada `24px` en el árbol de expedientes, pestañas y
  módulos técnicos.
- **Ficha:** pequeños rótulos, reglas y subrayados para señalar estados de
  archivo, página y guardado.

La textura nunca se aplica sobre texto largo ni bloquea eventos. Debe desaparecer
en impresión, `forced-colors`, alto contraste y `prefers-reduced-data`.

## 3. Composición y responsive

Seabell es una aplicación de escritorio. La experiencia completa parte de
`md` porque la página actual ya informa que la herramienta está disponible solo
desde PC.

### Marco de aplicación

La ventana se organiza en cuatro bandas:

1. **Barra superior:** menú Archivo, estado de guardado, cuenta y salida.
2. **Pestañas:** home, expedientes, PDFs y documentos editables abiertos.
3. **Área de trabajo:** explorador de archivos, documento principal y panel
   contextual cuando corresponda.
4. **Estado inferior o flotante:** progreso de carga, selección, búsqueda y
   mensajes no bloqueantes.

El área de trabajo ocupa `100svh`; el PDF y el editor deben poder usar todo el
alto disponible sin scroll de la página. El explorador parte de `256px–280px` y
los paneles contextuales de `320px–384px`. El contenido central siempre puede
reducirse con `min-width: 0`.

### Breakpoints

| Nombre | Inicio | Cambio típico |
| --- | ---: | --- |
| Base | `< 768px` | Mensaje de acceso desde PC; no cargar el workspace completo |
| `md` | `768px` | Workspace visible, barra superior y árbol lateral |
| `lg` | `1024px` | Paneles laterales completos y controles con etiquetas |
| `xl` | `1280px` | Más aire entre explorador, documento y panel contextual |
| `2xl` | `1536px` | Aumenta el margen interno, no el tamaño tipográfico indefinidamente |

La aplicación es desktop-first desde `md`, pero conserva orden, foco, contraste y
targets de al menos `44px` para controles que puedan usarse en una pantalla
pequeña. El mensaje de móvil debe explicar la restricción sin parecer un error.

### Ritmo espacial

- Barra superior: `48px–56px`.
- Pestañas: `44px–48px`.
- Padding de vistas de inicio y configuración: `24px` móvil, `32px–48px`
  desde `md`.
- Separación entre título y descripción: `12px–20px`.
- Separación antes de acciones o listas: `24px–40px`.
- Paneles densos: padding `12px–16px`.
- Home: mantener un bloque inicial con aire; no convertirla en una grilla de
  tarjetas sin jerarquía.

## 4. Componentes

### Autenticación

`AuthGate` controla carga, error y sesión; `AuthScreen` contiene login y
registro. La vista debe sentirse como la entrada a un archivo de trabajo, no
como una pantalla genérica de SaaS.

- Fondo de lienzo con papel o grilla muy sutil.
- Marca arriba del título, icono local y wordmark solo si corresponde.
- Título serif; labels y ayudas en Lilex; botón y mensajes técnicos en mono.
- Formulario estrecho, labels explícitos, campos de `44px` mínimo y foco visible.
- El error aparece junto al formulario y conserva `role="alert"`.
- La animación de entrada puede mantenerse corta; los orbes decorativos actuales
  se reemplazarán por textura o patrón CSS liviano.

### Barra superior y pestañas

La barra actual de `PdfImporter` es el chrome principal de la aplicación.

- Mantener `Archivo`, estado de autoguardado, cuenta y `Salir` en una jerarquía
  clara.
- Usar IBM Plex Mono para acciones y metadatos de guardado.
- Las pestañas de PDF, expediente y documento editable tienen icono, nombre,
  estado y cierre.
- La pestaña activa se distingue por superficie, borde y texto; nunca solo por
  color.
- Las pestañas deben soportar overflow horizontal, foco de teclado y `Escape`
  cuando un menú o panel se cierre.
- El hover puede elevar la pestaña `1px`; el active la devuelve a su posición.

### Botones, links y controles

Reutilizar `apps/web/src/components/ui/button.tsx` e `input.tsx` antes de crear
variantes nuevas.

- **Primary:** verde de marca, texto de marca y pequeño inset inferior verde
  oscuro.
- **Secondary/outline:** superficie blanca, borde estándar e inset gris-verde.
- **Ghost:** solo para acciones contextuales, iconos y chrome secundario.
- **Destructive:** rojo semántico, con texto explícito; no depender del color.

Los botones usan IBM Plex Mono, altura `36px` en escritorio y `44px` en controles
que puedan ser táctiles. Al presionarse bajan `2–3px` y reducen el inset. El foco
usa `2px` de alto contraste con offset. No agregar una variante de botón por cada
caso visual.

### Home y documentos recientes

`HomeScreen` debe ser una portada de trabajo, no un dashboard:

- Título serif y bajada que expliquen revisar, ordenar y anotar documentos.
- Acciones principales: `Abrir PDF`, `Abrir .abn` y `Crear expediente`.
- `Crear documento` puede aparecer como acción secundaria si la vista lo
  necesita, sin competir con abrir un documento existente.
- La sección `Recientes` usa una grilla sobria de `RecentDocCard`, con icono,
  nombre, tamaño y última modificación.
- Los documentos recientes son botones accesibles con borde visible, hover,
  focus y estado presionado.
- El estado sin documentos debe explicar el flujo local-first y ofrecer una
  acción directa.

### Explorador y expedientes

`ExpedienteView`, `FileTree` y `NewExpedienteDialog` forman la estructura del
archivo.

- El árbol es una columna estructural continua, no una colección de tarjetas.
- Carpetas y PDFs usan sangría, iconos y bordes de estado; el nombre sigue siendo
  la señal principal.
- Los colores de expediente existentes distinguen grupos, pero siempre se
  combinan con icono, etiqueta o superficie.
- Drag and drop debe tener una alternativa por menú contextual o acción visible.
- Renombrar, mover y eliminar muestran foco y no pierden el contexto del árbol.
- El diálogo de nuevo expediente conserva labels, validación y cierre con
  `Escape`.

### Visor PDF

`PdfViewer` es el centro visual de Seabell y debe recibir el mayor contraste de
  jerarquía.

- La página PDF es una hoja clara sobre un lienzo suave, con espacio reservado y
  escala legible.
- Los controles inferiores de página y zoom se comportan como una herramienta
  física compacta, no como una barra de botones dispersa.
- Búsqueda, destacados, cronología y leyes citadas aparecen como paneles
  contextuales que no destruyen el ancho del documento.
- La selección de texto y los colores de destacado deben ser visibles sobre la
  página sin competir con el texto original.
- Los estados `Preparando PDF`, error, búsqueda y selección se anuncian y no
  dependen únicamente de color.

### Paneles de búsqueda, destacados, cronología y leyes

Reutilizar `PdfSearchPanel`, `PdfHighlightsPanel`, `PdfTimelinePanel` y
`PdfLawsPanel` como una familia.

- Mismo encabezado: icono, título, acción de cierre y borde.
- Fondo de superficie, sombra lateral corta y scroll interno.
- IBM Plex Mono para páginas, fechas, tipos de norma y metadatos.
- Lilex para resultados y explicaciones; serif solo para hallazgos destacados o
  títulos que necesiten énfasis.
- Cada panel debe conservar la referencia de página y permitir volver al PDF.
- El contenido legal externo debe mostrar su fuente y advertencia; no presentarlo
  como asesoría jurídica.

### Editor de documentos

`WordEditor` usa la misma gramática del visor, pero con una hoja editable.

- Toolbar compacta, agrupada por acción y separada del contenido por un borde.
- La hoja usa superficie blanca, borde/sombra mínima y tipografía de lectura.
- Títulos del documento pueden usar Averia Serif Libre; el cuerpo debe seguir
  siendo cómodo para escritura prolongada.
- Buscar, reemplazar y exportar `.doc` mantienen estados claros y foco visible.
- Impresión elimina textura, chrome y sombras.

### Configuración y cuenta

La vista de configuración debe permanecer dentro del workspace, usando una
estructura de lectura de máximo `720px`.

- Título serif, explicación breve y secciones con borde.
- Los colores de destacado usan controles radio con nombre, estado y foco; no
  solo círculos sin texto accesible.
- La cuenta, autoguardado, privacidad y exportación deben usar lenguaje directo.

## 5. Estados y flujo de trabajo

Los estados visuales mínimos son:

1. Cargando sesión.
2. Error de autenticación o restauración local.
3. Home vacía.
4. Home con documentos recientes.
5. Importando o validando PDF/`.abn`.
6. Workspace con pestañas.
7. Expediente sin PDF seleccionado.
8. PDF cargando, listo o con error.
9. Panel contextual abierto.
10. Autoguardado apagado, guardando, guardado o con error.
11. Configuración abierta.

Cada estado debe tener una señal de texto o estructura además del color. Los
errores no deben desaparecer automáticamente si el usuario necesita actuar.

## 6. Movimiento e interacción

El movimiento cumple uno de tres roles:

- **Respuesta:** presión de botones, selección de pestaña y drag and drop.
- **Orientación:** entrada de autenticación, apertura de panel y cambio de vista.
- **Explicación:** progreso de importación, búsqueda, restauración y guardado.

Reglas:

- Microinteracciones de `150–300ms`, con `ease-out` o
  `cubic-bezier(0.22, 1, 0.36, 1)`.
- No animar el layout completo ni mover el documento mientras se lee.
- No usar orbes, parallax, scroll storytelling ni fondos animados para decorar.
- El contenido y el estado final aparecen aunque la animación no corra.
- `prefers-reduced-motion` elimina desplazamientos y deja solo cambios de estado
  instantáneos.

## 7. Accesibilidad

Toda extensión debe conservar como mínimo:

- HTML semántico y una jerarquía de headings sin saltos.
- Un solo `h1` por vista principal y `aria-labelledby` cuando aporte contexto.
- Navegación completa por teclado; `Escape` para menús, diálogos y paneles.
- Foco visible de alto contraste en botones, pestañas, enlaces, inputs y árbol.
- Targets de al menos `44 × 44px` en controles accionables.
- `aria-selected` y `role="tablist"` coherentes en pestañas.
- `aria-live="polite"` para importación, guardado y resultados dinámicos.
- `role="alert"` y `aria-describedby` para errores asociados a campos.
- `alt` útil en imágenes informativas y `aria-hidden` en iconos ornamentales.
- El color nunca es la única señal de selección, error, expediente o destacado.
- Contraste suficiente en papel, superficies y textos secundarios.
- Textura, sombra y animación deshabilitadas en impresión, forced colors y
  reduced motion cuando puedan interferir.

## 8. Voz y contenido

- Español claro, concreto y latinoamericano, con registro chileno cuando el
  contexto legal lo requiera.
- Hablar primero de revisar, ordenar, encontrar y anotar; después de PDF,
  IndexedDB, `.abn` o API.
- Preferir verbos activos: abrir, buscar, destacar, ordenar, guardar, exportar,
  restaurar y consultar.
- Evitar promesas legales o frases que sugieran asesoría jurídica.
- Explicar que los documentos permanecen localmente y que las consultas de leyes
  pueden usar fuentes externas.
- Mantener la capitalización: **Seabell** en texto y el icono/wordmark de Seabell
  en la marca visual.

## 9. Implementación

- Crear y cargar únicamente las cuatro familias locales definidas arriba;
  retirar Geist de `apps/web/src/app/layout.tsx` cuando se aplique el diseño.
- Centralizar tokens `sb-*` y estados en `apps/web/src/app/globals.css`.
- Reutilizar `Button`, `Input`, `DropdownMenu`, `Menubar` y los paneles
  existentes antes de duplicar estilos.
- Mantener `PdfImporter` como coordinador; no introducir un estado global nuevo
  para resolver problemas visuales.
- Mantener Server Components donde sea posible; el workspace sigue siendo cliente
  solo porque necesita APIs de archivos, canvas, selección y almacenamiento.
- Usar `lucide-react` ya instalado para iconos; no agregar otra librería.
- Mantener logo, fuentes, texturas e iconos en el repositorio. No cargar recursos
  de terceros ni tracking.
- Reservar dimensiones de hojas, paneles y controles para evitar CLS.
- No cambiar el modelo local-first ni enviar PDFs al backend como consecuencia de
  una actualización visual.

## 10. Rendimiento y verificación

Todo cambio visual relevante se verifica sobre producción:

```bash
rtk pnpm lint
rtk pnpm typecheck
rtk pnpm test:unit
rtk pnpm build
rtk pnpm start
rtk npx lighthouse http://localhost:3000 \
  --output=html \
  --output-path=./.lighthouse/report.html \
  --chrome-flags="--headless --no-sandbox" \
  --quiet
```

Objetivos mínimos:

- Performance, Accessibility, Best Practices y SEO: `>= 95` cuando aplique a
  la ruta.
- FCP `< 1.8s`, LCP `< 2.5s`, CLS `< 0.1`, TBT `< 200ms`.
- JavaScript inicial propio `< 100kB` comprimido cuando sea viable.
- Cada fuente e imagen local debe justificarse; mantener imágenes bajo `250kB`.
- No introducir requests remotos por fuentes, iconos, tracking o fondos.
- `.lighthouse/` y artefactos temporales deben permanecer ignorados por Git.

## 11. Checklist para aplicar el nuevo diseño

- [ ] La vista tiene jerarquía editorial/técnica, no solo nuevos colores.
- [ ] Las fuentes Averia Serif Libre, Lilex, IBM Plex Mono y Unbounded son locales.
- [ ] El wordmark no reemplaza ni distorsiona `logo.svg`.
- [ ] La interfaz usa tokens `sb-*`; no repite hexadecimales en componentes.
- [ ] Home, autenticación, workspace, visor, paneles, editor y configuración
      comparten la misma gramática.
- [ ] La estructura de pestañas, árbol y paneles sigue siendo visible sin sombra.
- [ ] Hover, focus, active, disabled, error y reduced motion están resueltos.
- [ ] Mobile conserva un mensaje claro y no intenta cargar un workspace ilegible.
- [ ] No se agregaron dependencias, recursos externos ni tracking.
- [ ] No se modificó el comportamiento local-first ni la privacidad de PDFs.
- [ ] Lint, typecheck, tests, build y Lighthouse pasan o reportan la métrica
      afectada y su causa.

## 12. Referencias en el repositorio

- Tokens, fuentes, textura, estados y motion: [`apps/web/src/app/globals.css`](apps/web/src/app/globals.css)
- Entrada y restricción de viewport: [`apps/web/src/app/page.tsx`](apps/web/src/app/page.tsx)
- Metadata y fuentes: [`apps/web/src/app/layout.tsx`](apps/web/src/app/layout.tsx)
- Coordinación del workspace: [`apps/web/src/components/pdf-importer.tsx`](apps/web/src/components/pdf-importer.tsx)
- Autenticación: [`apps/web/src/components/auth-gate.tsx`](apps/web/src/components/auth-gate.tsx), [`apps/web/src/components/auth-screen.tsx`](apps/web/src/components/auth-screen.tsx)
- Home y recientes: [`apps/web/src/components/home-screen.tsx`](apps/web/src/components/home-screen.tsx), [`apps/web/src/components/recent-doc-card.tsx`](apps/web/src/components/recent-doc-card.tsx)
- Expedientes: [`apps/web/src/components/expediente-view.tsx`](apps/web/src/components/expediente-view.tsx), [`apps/web/src/components/file-tree.tsx`](apps/web/src/components/file-tree.tsx), [`apps/web/src/components/new-expediente-dialog.tsx`](apps/web/src/components/new-expediente-dialog.tsx)
- PDF y paneles: [`apps/web/src/components/pdf-viewer.tsx`](apps/web/src/components/pdf-viewer.tsx), [`apps/web/src/components/pdf-search-panel.tsx`](apps/web/src/components/pdf-search-panel.tsx), [`apps/web/src/components/pdf-highlights-panel.tsx`](apps/web/src/components/pdf-highlights-panel.tsx), [`apps/web/src/components/pdf-timeline-panel.tsx`](apps/web/src/components/pdf-timeline-panel.tsx), [`apps/web/src/components/pdf-laws-panel.tsx`](apps/web/src/components/pdf-laws-panel.tsx)
- Editor de documentos: [`apps/web/src/components/word-editor.tsx`](apps/web/src/components/word-editor.tsx)
- Controles base: [`apps/web/src/components/ui/button.tsx`](apps/web/src/components/ui/button.tsx), [`apps/web/src/components/ui/input.tsx`](apps/web/src/components/ui/input.tsx)
- Marca: [`apps/web/public/logo.svg`](apps/web/public/logo.svg)
