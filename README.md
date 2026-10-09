# The Pink House — estado de continuidad

## Estado actual

La implementación está pausada para revisión en la rama `codex/reference-fidelity-halloween`. Los cambios siguen sin commit para conservar todo el trabajo editable. No se ha hecho deploy, merge ni push.

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
- Panel `PINK HOUSE ARCHIVE` con gradiente sincronizado al scroll: naranja brillante, foco ámbar móvil y rojo carmesí.
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

- El gradiente intenso fue revisado en captura Playwright y quedó aprobado visualmente para esta iteración.
- El header quedó como `THE PINK HOUSE` y la etiqueta duplicada `__005` fue retirada.
- La unión visual entre `Tu entrada __004` y el ticket fue validada en 1440×900, 390×844 y 320×760.
- La comprobación focalizada posterior a esos cambios pasó 9/9 pruebas.
- Los archivos de QA permanecen como artefactos locales dentro de `output/`; no se agregan al commit salvo los reportes y manifiestos que ya forman parte del historial de trabajo.

Antes de publicar fuera del entorno local todavía debe confirmarse la licencia de las fuentes descargadas. El siguiente paso de producto requiere autorización explícita para merge, push o deploy.

La resolución exportada del artwork coincide con las dimensiones de trabajo usadas por la referencia, pero la imagen original es una creación nueva y no una copia pixel a pixel de la fotografía del sitio de referencia.
