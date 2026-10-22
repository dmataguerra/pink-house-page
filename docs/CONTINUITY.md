# The Pink House — estado de continuidad

## Página simplificada desde producción

La rama `codex/halloween-countdown` parte de `main` en `35a10bd`, confirmado por Cloudflare como el commit desplegado. Conserva header, animación de entrada, título y asistencia; reemplaza el recorrido por un contador grande de horas totales hasta el 22 de octubre de 2026 a las 20:00 del centro de México. El menú mantiene asistencia, agenda, ticket e Instagram y navega a inicio, contador y fecha/hora. Detalles y capturas: [HALLOWEEN_COUNTDOWN.md](HALLOWEEN_COUNTDOWN.md).

Esta implementación se realizó en un worktree aislado y no incorpora los cambios locales pendientes del checkout principal.

## Estado activo — 13 de octubre de 2026

La implementación actual y sus pendientes están en `docs/GLOBE_IMPLEMENTATION_AUDIT.txt`. Este estado reemplaza las descripciones históricas de abajo. La vista de desarrollo es `http://127.0.0.1:5174/`, con acceso al cierre en `/#mapa`.

El globo usa Three.js r182/WebGL2: esfera geográfica, ruido Worley deformado por el cursor, corona con dos buffers y composición final. Una capa fija de tamaño de viewport se ejecuta desde la carga inicial y se revela con el scroll recuperado de la referencia. Conserva el mapa local, los cuatro puntos y sus acciones, movimiento reducido, arrastre, teclado y recuperación de contexto. Todos los botones visibles del globo y el CTA independiente de asistencia se retiraron por petición del usuario.

El footer tiene logo pequeño a la izquierda, próximo evento y contador a la derecha. La última elección restaura el tejado de HOUSE sobre PINK, refinado con mejor simetría, peso y espaciado. Está aplicado en header, introducción y footer; este último conserva el 70% de la altura del bloque del evento. SVG de proporción 214/144, header de 64/52px. Evidencia y antes/después en `output/logo-refined`. Hay seis conceptos en `output/logo-variants` y ocho tipografías originales en `output/logo-typography`. El archivo conserva EL 30, TRIO FEST y HALLOWEEN 2025; su descripción es «Tuvo que aprender a caminar para que HALLOWEEN 26 pudiera correr».

El plan tiene nueve actividades: película preparty «La venganza del charro negro» sin hora asignada, Inicio 8:00pm, Dinámicas 8:10pm, Piñata 9:00pm, Concurso de disfraz 9:20pm, Foto grupal 9:40pm, Beer pong 10:30pm, Batalla de Tilín insano 11:30pm y Perreo intenso 12:00am. Fuente central `src/data/nightSchedule.ts`; componente `NightSchedule.tsx`. La medianoche usa fecha 23 de octubre. Validación específica 21/21 y capturas en `output/itinerary-qa`.

Asistencia, agenda y entrada comparten un modal oscuro con bordes rojos y tipografía Inter. Las dos imágenes de enlaces, recortes y URLs originales están preservados y verificados en `output/modal-qa`. Las evidencias del renderer están en `output/globe-qa`. No se ha publicado, desplegado, enviado ni fusionado ningún cambio de esta sesión.

## Historial de estados previos

## Actualización 12 oct2026 — referencia After Dark

El diseño actual toma como referencia [Nike After Dark Tour — Ciudad de México](https://www.afterdarktour.nike.com/es/mexicocity), adaptado al contenido y a los assets propios de The Pink House. Esta actualización reemplaza la composición editorial anterior en la página activa; el historial que sigue debajo se conserva como registro de las iteraciones previas.

### Estado actual de la página

- Fondo negro, superficies oscuras y rojo `#f11313`, con luces rosas/magenta en la esfera. La instrucción posterior del usuario reemplazó naranja/ámbar por la paleta de la referencia; los originales se conservan. La tipografía activa es Inter Variable con licencia OFL incluida.
- Hero con `THE PINK HOUSE`, edición `HALLOWEEN`, fecha `22 OCT 2026`, confirmación de asistencia y dos fotografías originales: fiesta con duotono rojo por CSS y manos reunidas en blanco y negro.
- Header flotante con el nombre `THE PINK HOUSE`, sin año ni icono de casita. Menú con navegación, asistencia, agenda y `Tu entrada`.
- Información propia en las secciones `Sobre la noche`, detalles del evento y cómo encontrarnos. La fecha y hora se mantienen: jueves 22 de octubre de 2026, desde las 20:00, hora del centro de México. Los horarios posteriores de la agenda siguen siendo sugeridos.
- La sección `Pedas anteriores`, con ancla `#archive`, contiene exactamente tres píldoras `PEDA 01` a `PEDA 03`. Cada una abre el placeholder `Nombre y recuerdos próximamente.`; no se inventaron nombres, fechas ni recuerdos. La sección reemplaza las preguntas frecuentes. No hay chatbot.
- El ticket de momia se abre desde `Tu entrada` en el menú, dentro de un modal. Conserva corte con mouse, touch y teclado y el acceso al plan de la noche.
- Barra fija con `FALTA:`, cuenta regresiva, fecha e inicio. Se oculta cuando entra el cierre completo para evitar tapar la esfera y sus controles.
- Footer con `PRÓXIMO EVENTO:` y botón `HALLOWEEN`, además del nombre y el lema de la casa.
- Esfera interactiva basada en la geografía local de Juriquilla, Querétaro, con los cuatro puntos suministrados para el video: UAQ, UVM, ENES y The Pink House. Conserva esos puntos y su relación espacial. Las coordenadas y la dirección privada no se repiten en esta documentación pública.

### Assets y video

- Foto naranja final con grano: `public/images/after-dark-party-grain.webp`, 1254 × 1254, calidad WebP 92, 466,920 bytes. Editada con la herramienta integrada de imágenes; grano visible verificado a 600 y 345 px, con PNG y variantes anteriores conservados. Procedencia y prompt en `docs/ORANGE_PALETTE.md`.
- Foto de comunidad con grano: `public/images/after-dark-community-grain.webp`, en blanco y negro; el original se conserva.
- Mapa de la esfera: `public/images/juriquilla-map.svg`; se adapta a la esfera sin convertir los puntos locales en ubicaciones globales.
- Variante de video anterior conservada: `public/videos/pink-house-after-dark.mp4`, 17 segundos, 1280 × 720, 30 fps, 510 cuadros y H.264/yuv420p, sin audio y con faststart; 12,014,590 bytes. Comienza exactamente 3 segundos después del inicio de la variante naranja anterior. Poster `public/images/pink-house-after-dark-preview.webp`, extraído del nuevo cuadro inicial a calidad WebP 90. Metadatos, conteo de cuadros y decodificación completa verificados sin errores en `output/after-dark-video-orange/qa.json`. La versión naranja completa de 20 segundos y su poster se conservan en `output/after-dark-video-orange/full-20s.mp4` y `poster-full-20s.webp`. La geografía, los cuatro puntos y la paleta naranja/ámbar se mantienen.
- Renderer reproducible: `aerial/scripts/render-after-dark.ts`, apoyado en el renderer de geometría existente y los datos locales; empieza en el cuadro fuente 390 y produce 510 cuadros. Sus carpetas de trabajo incluyen `v2-start390-17s` para evitar reutilizar cuadros antiguos. El video original `public/videos/pink-house.mp4` se conserva. Los datos incluyen OpenStreetMap, Overture y Microsoft; alturas estimadas y volumen ilustrativo de ENES se mantienen documentados en `docs/AFTER_DARK_ASSETS.md`.

### Archivos activos para continuar

- `src/App.tsx`: composición, contenido del evento y estado de los modales.
- `src/components/AfterDarkHeader.tsx`: header, menú y barra con cuenta regresiva.
- `src/components/AfterDarkLocation.tsx`: poster, reproducción del mapa y vista ampliada.
- `src/sections/AfterDarkFAQ.tsx` y `AfterDarkFAQ.css`: archivo de tres pedas; el nombre del archivo se conserva por integración, aunque ya no muestra FAQ.
- `src/sections/AfterDarkClosing.tsx` y `AfterDarkClosing.css`: esfera de Juriquilla y footer.
- `src/styles.css`: paleta, composición general, responsive y estilos de modales.
- `src/components/MummyTicket.tsx`, `src/components/Countdown.tsx` y `src/config/event.ts`: ticket, cuenta regresiva y datos confirmados.

La ruta de desarrollo actual es `/`: ejecutar `npm run dev` y abrir la dirección que indique Vite. El recorrido activo usa `acercamiento-orbital.mp4`, con poster propio `juriquilla-orbital-preview.webp`, pausa automática y vista plana interactiva. El estudio, inventario de cambios y comprobaciones de navegador están en `docs/AFTER_DARK_EXPERIENCE.md`. Esta actualización no registra deploy, merge, push ni commit nuevos.

---

## Historial anterior — referencia editorial

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
