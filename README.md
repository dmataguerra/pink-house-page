# The Pink House — estado de continuidad

## Estado actual

La implementación se mantiene en la rama `codex/reference-fidelity-halloween`. Los cambios terminados se guardan en commits locales. No se ha hecho deploy, merge ni push.

La página local se sirve en:

`http://localhost:5173/pink-house-page/`

La referencia visual analizada es `https://13322566869.com/`, principalmente su primera mitad. Los PDF entregados por el usuario son capturas de apoyo visual; no deben interpretarse como instrucciones funcionales independientes.

## Lo que ya está implementado

- Hero editorial con `PINK / HOUSE`, fecha 2026, personaje original en overol oscuro y máscara inspirada en el lenguaje visual de Michael Myers.
- Tipografía Founders Grotesk descargada para reproducir tamaños, pesos, tracking y ritmo de la referencia.
- Composición de personaje entre el fondo y la tipografía gigante, con filtro de alpha para evitar que las letras atraviesen el cuerpo.
- Video MP4 existente en el reproductor flotante y reproducción ampliada con controles nativos.
- Header mínimo, menú modal, navegación por anclas, countdown, RSVP y modal de agenda.
- Secciones editoriales blancas, transición sticky, archivo visual, tarjetas A/B/C/D y contenido español del evento.
- Panel `PINK HOUSE ARCHIVE` en marfil cálido (`#e9e3d8`) con tipografía carbón (`#24221e`), sin gradiente, conservando el deslizamiento para dar descanso a la paleta roja/ámbar.
- `Referencia OG` ahora usa `public/images/archive-knife-cinematic.png`, con mango de madera y filo de sierra.
- Ticket de momia reintroducido con corte por arrastre, mouse, touch y teclado; ojos, tijeras y línea de corte usan el acento `#e85a32`.
- El header muestra únicamente `THE PINK HOUSE`.
- La etiqueta duplicada `Tu entrada __005` se eliminó: el ticket quedó unido visualmente a la sección `Tu entrada __004`.

## Archivos principales

- `src/App.tsx`: composición general, modales y footer.
- `src/components/HeroLanding.tsx` y `HeroLanding.css`: hero, capas, personaje y tipografía principal.
- `src/components/HeroInterface.tsx`: header, menú y countdown.
- `src/components/HeroVideo.tsx`: preview y reproducción ampliada del MP4.
- `src/sections/Editorial.tsx` y `Editorial.css`: identidad, detalles, gradiente Archive, collage, RSVP y scroll animations.
- `src/sections/AdmissionTicket.tsx` y `AdmissionTicket.css`: unión visual del ticket con `Tu entrada __004`.
- `src/components/MummyTicket.tsx` y `MummyTicket.css`: interacción y estilo del ticket.
- `src/data/parties.ts`: imágenes y títulos del archivo.

## Assets generados

Los principales assets finales están en `public/images/`:

- `halloween-portrait-scene.webp` y `halloween-portrait-cutout.webp`
- `archive-house-cinematic.webp`
- `archive-mask-cinematic.webp`
- `archive-party-cinematic.webp`
- `archive-prize.webp`
- `archive-location.webp`
- `archive-prize-documentary.png`
- `archive-location-documentary.png`
- `archive-knife-cinematic.png`
- `instagram-profile-cinematic.webp`

Las fuentes y la procedencia de los prompts, medidas y capturas se conservan en `output/reference/`, `output/art-reference/` y `output/qa/`.

## Validación realizada

- `npm run build` pasa.
- `npm run typecheck` pasa.
- Regresión Playwright completa: 35 pruebas aprobadas en 1440×900, 390×844 y 320×760, incluyendo RSVP, countdown, MP4, navegación, ticket, overflow, assets y reduced motion.
- Comparaciones visuales guardadas en `output/qa/iteration-04-final/` y `output/qa/iteration-05-gradient/`.
- El último screenshot de referencia para el gradiente es `output/qa/iteration-05-gradient/desktop-local-y5400.png`.
- La verificación de capas del personaje está en `output/qa/real-layers/real-layer-verification.json`.

## Cómo continuar

Desde `C:\Projects\pink-house-page`:

```powershell
npm run dev
```

Abrir `http://localhost:5173/pink-house-page/`. Para producción local:

```powershell
npm run build
```

Para repetir la regresión con el runtime Playwright disponible en esta máquina:

```powershell
$env:QA_URL='http://localhost:5173/pink-house-page/'
Remove-Item Env:QA_TEST_FILTER -ErrorAction SilentlyContinue
& 'C:\Users\dmata\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' output\qa\rebuild-functional.cjs
```

Para repetir la comparación visual:

```powershell
& 'C:\Users\dmata\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' output\qa\compare.cjs iteration-next
```

## Estado de cierre de esta iteración

- Mejoras móviles: detalles separados del hero en un resumen blanco, CTA de asistencia visible de 52px y contraste reforzado en la introducción.
- Validación posterior a las mejoras móviles y bebidas: build correcto y 35/35 pruebas Playwright aprobadas; capturas en `output/qa/mobile-improvements/`.
- Archive móvil reduce su recorrido de 300vh a 170vh y muestra el título completo sobre una base legible.
- Hero móvil usa variantes WebP de 1440px: sus dos capas suman 135 KB frente a 855 KB originales (84% menos).
- Premio, ubicación y cuchillo se sirven en WebP: 341 KB frente a 6,9 MB de PNG (95% menos). Los PNG originales se conservan.
- La segunda entrada del archivo es `What's your poison?`, con fotografía de bebidas y el texto: `Trae lo que te gusta tomar. También habrá bebidas de nuestra parte.`
- Arte nuevo: `public/images/archive-drinks-documentary.webp`, generado con la herramienta integrada. Prompt: fotografía documental de película 35mm de una mesa de bebidas en fiesta Halloween, botellas sin marca, vasos rojos, cubeta de hielo y una mano sirviendo; iluminación roja y ámbar, grano, textura natural, sin texto ni acabado CGI.

- El panel neutro de Archive fue revisado en capturas móviles Playwright y la compilación pasa.
- El header quedó como `THE PINK HOUSE` y la etiqueta duplicada `__005` fue retirada.
- La unión visual entre `Tu entrada __004` y el ticket fue validada en 1440×900, 390×844 y 320×760.
- La comprobación focalizada posterior a esos cambios pasó 9/9 pruebas.
- Los archivos de QA permanecen como artefactos locales dentro de `output/`; no se agregan al commit salvo los reportes y manifiestos que ya forman parte del historial de trabajo.

Antes de publicar fuera del entorno local todavía debe confirmarse la licencia de las fuentes descargadas. El siguiente paso de producto requiere autorización explícita para merge, push o deploy.

La resolución exportada del artwork coincide con las dimensiones de trabajo usadas por la referencia, pero la imagen original es una creación nueva y no una copia pixel a pixel de la fotografía del sitio de referencia.
