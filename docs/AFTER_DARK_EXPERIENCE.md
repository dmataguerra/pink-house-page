# The Pink House: experiencia After Dark

Este documento conserva la validación de la primera adaptación del12 de octubre. El renderer, logo, footer y modales posteriores se describen en `GLOBE_IMPLEMENTATION_AUDIT.txt`; sus resultados actuales reemplazan las cifras y controles históricos siguientes.

Actualización del 12 de octubre de 2026. La instrucción posterior del organizador reemplazó la paleta naranja por los colores de la referencia y autorizó una tipografía equivalente. Se conserva el contenido de The Pink House y exactamente tres pedas anteriores.

## Estudio de la referencia

Se inspeccionó [Nike After Dark Tour, Ciudad de México](https://www.afterdarktour.nike.com/es/mexicocity) en navegador, con DOM, estilos computados, mediciones, capturas e interacción. No se descargaron ni incorporaron código, imágenes, logos, mapas o fuentes de Nike.

| Aspecto observado | Medición / adaptación |
| --- | --- |
| Rojo editorial | `rgb(241, 19, 19)`, exactamente `#f11313` |
| Fondo | Negro `#000000` |
| Header | `rgba(17, 17, 17, .7)`; cápsula centrada, ancho aproximado 64.1% en escritorio |
| Menú abierto | Cápsula aproximada 78.6% en escritorio; ancho disponible en móvil |
| Titulares | Escala cercana a `7.7vw`, límite 140 px; entrada a 200 px en escritorio y 110 px en móvil |
| Retícula | 12 columnas, narrativa en la mitad derecha; 6 columnas y texto completo en móvil |
| Fotografías | Dos cuadrados, separación 20 px; apilados en móvil |
| Texto editorial | 30–40 px en escritorio y 20 px en móvil |
| Espacios entre módulos | Aproximadamente 200 px en escritorio y 160 px en móvil |
| Mapa | 16:9 en escritorio y 2:3 en móvil; pausa y selector de vista |
| Cierre | Esfera grande centrada, iluminación roja/rosa, halo y niebla, marcadores sobre la superficie |
| Interacciones | Hover, foco, menú, Escape, scroll, drag, touch horizontal, scroll vertical y orientación |
| Movimiento reducido | La referencia seguía cambiando el canvas en las observaciones; la aplicación propia congela niebla, giro e inercia |

Los datos y capturas de investigación están en `output/experience-qa/reference/measurements.json` e `interactions.json`. Son evidencia de QA, no assets servidos por la aplicación.

## Implementación

Se conserva React/TypeScript/Vite, el ticket y los modales existentes, el video orbital, la cartografía SVG local y el shader WebGL propio. No se incorpora Cesium ni Mapbox al bundle principal.

- Tokens comunes para rojo, rosa, negro, superficies y tipografía. Fotos propias con duotono CSS rojo, sin modificar sus originales.
- Inter Variable autohospedada, con pesos y espaciados ajustados al carácter editorial de la referencia. [Origen oficial](https://rsms.me/inter/inter.css), [licencia SIL OFL 1.1](https://github.com/rsms/inter/blob/master/LICENSE.txt). WOFF2 normal, 352240 bytes; licencia incluida en `public/fonts/Inter-LICENSE.txt`.
- Fuentes antiguas Founders Grotesk sin licencia verificada excluidas del build mediante `sanitize-build.mjs`; originales del workspace conservados.
- Intro con tres imágenes propias progresivas, transiciones suaves, duración máxima 1.8 s y una presentación por sesión; se omite con movimiento reducido.
- Mapa plano con zoom, arrastre y teclado; recorrido 3D en el video propio, carga cerca del viewport, poster derivado del mismo clip, pausa por visibilidad, pestañas y ampliación.
- Esfera WebGL con iluminación, bruma y profundidad; giro, inercia, zoom, reset, pausa, flechas, Home, botones y touch horizontal. Scroll vertical de página conservado.
- Marcadores UAQ/UVM/ENES abren fichas; The Pink House abre confirmación. Los hitboxes se separan sin desplazar los puntos geográficos.
- Renderer suspendido fuera de pantalla y en background, DPR limitado y cadencia móvil reducida. Fallback utilizable y recuperación tras pérdida del contexto.
- Modales con Tab/Shift+Tab contenido, Escape, bloqueo de scroll y retorno del foco. Tres pedas con controles semánticos y transición de apertura.

## Archivos cambiados

| Grupo | Archivos |
| --- | --- |
| Composición y tema | `src/App.tsx`, `src/styles.css`, `index.html` |
| Navegación y modales | `src/components/AfterDarkHeader.tsx`, `src/components/SiteModal.tsx` |
| Mapa | `src/components/AfterDarkLocation.tsx`, `src/components/AfterDarkLocation.css` |
| Introducción y ticket | `src/components/OpeningCollage.tsx`, `src/components/OpeningCollage.css`, `src/components/MummyTicket.css` |
| Archivo y cierre | `src/sections/AfterDarkFAQ.tsx`, `src/sections/AfterDarkFAQ.css`, `src/sections/AfterDarkClosing.tsx`, `src/sections/AfterDarkClosing.css` |
| Movimiento | `src/hooks/useMotionPreference.ts`, `src/hooks/usePageMotion.ts` |
| Recursos propios / libres | `public/images/juriquilla-orbital-preview.webp`, `public/fonts/InterVariable.woff2`, `public/fonts/Inter-LICENSE.txt` |
| Comprobaciones | `package.json`, `scripts/sanitize-build.mjs`, `scripts/verify-experience.mjs`, `scripts/probe-reference.mjs`, `scripts/probe-reference-interactions.mjs` |
| Documentación | `README.md`, `docs/BRAND.md`, `docs/CONTINUITY.md`, `docs/ORANGE_PALETTE.md`, este informe |

## Validación

`npm run typecheck`, `npm test`, `npm run build` y `npm --prefix aerial test` pasan: 18 pruebas raíz y 36 de la infraestructura de video/cartografía.

La matriz de navegador cubre 320×568, 390×844, 844×390, 768×1024, 1024×768, 1440×900 y 1920×1080, además de cambios de orientación. Incluye centrado, overflow, fuente realmente cargada, rojo computado, ausencia de naranja en controles activos, menús, foco, las tres pedas, RSVP, agenda, ticket, vistas del mapa, video, gestures, movimiento reducido dinámico, fallback y recuperación WebGL.

Resultado: 407/407 comprobaciones en desarrollo y 122/122 en el build de producción a 390×844 y 1440×900. Informes: `output/experience-qa/red-palette/report.json` y `output/experience-qa/red-production/report.json`. Las capturas correspondientes están en esas mismas carpetas. El último ajuste de contraste de controles tiene una comprobación y capturas adicionales de producción.

Los tamaños y gestos se probaron mediante emulación de Chrome y el navegador integrado; no se afirma validación en dispositivos físicos ni Safari/iOS.

## Diferencias deliberadas

Helvetica Now Display se sustituye por Inter, según la elección del organizador. Los textos tienen longitudes propias, por lo que la altura total de la página y los saltos de línea difieren. El mapa local mantiene el video 3D existente: la navegación libre se ofrece en la vista plana y la esfera WebGL; no se incorpora la cartografía 3D ni la ruta de Nike. La geografía y los recursos siguen siendo propios.

Los controles de teclado, movimiento reducido, fallback y contraste se priorizan sobre reproducir limitaciones de la referencia. Los pequeños textos rojos usan superficies más oscuras cuando es necesario para legibilidad. No se publicó ni se modificó ningún servicio externo.
