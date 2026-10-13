# Globo y diseño final de The Pink House

13 de octubre de 2026. Globo, modales, footer y propuestas de logos completados y verificados. Implementación local en `http://127.0.0.1:5174/`; cierre en `/#mapa`. La auditoría de reanudación es `GLOBE_IMPLEMENTATION_AUDIT.txt`.

## Resultado implementado

El renderer anterior fue sustituido por Three.js 0.182.0/WebGL2 con cuatro pasadas: esfera geográfica real, ruido procedural deformado por el cursor, corona con feedback entre dos buffers y un plano final de composición. Mantiene la cartografía local de Juriquilla y las acciones de UAQ, UVM, ENES y The Pink House.

La deformación reproduce el WorleyF1 animado, gradiente Perlin anisótropo, oscilación radial, arrastre direccional y estela de CanvasTexture con desvanecimiento. La atmósfera combina máscaras circulares, expansión por máximo vecinal, desplazamiento por ruido y operaciones difference/exclusion. El puntero intersecta el plano cuadrado, incluidos sus rincones negros, conserva la última posición válida y usa las constantes de dirección, velocidad y persistencia documentadas. Giro automático6°/s, arrastre0.22/0.18° por píxel e inercia exp(-7.5dt).

Un único canvas ocupa el viewport desde la carga inicial. El scroll desplaza y reduce la capa del globo en la ventana final de1.5 pantallas, cambia su opacidad y añade288° de giro. La capa se mantiene detrás de la página; no se crea un segundo renderer al llegar al footer. Los puntos conservan sus coordenadas proyectadas mientras sus etiquetas se acomodan para poder leerse. Las cápsulas translúcidas acompañan a esas etiquetas, sin discos vacíos tras una colisión.

Todos los botones visibles del globo, incluida la pausa, y el CTA independiente de asistencia fueron retirados. Arrastre y teclado siguen disponibles. El punto de la casa y el evento del footer abren la confirmación.

## Integración de diseño

- Footer con dos columnas en móvil: logo pequeño a la izquierda y próximo evento, HALLOWEEN y contador compacto a la derecha. En escritorio conserva la retícula2/6/4 con espacio central. Por la última petición, el logo mide el70% de la altura del bloque del evento y se alinea abajo.
- Logo activo: identidad anterior de HOUSE formando el tejado sobre PINK, refinada tras la última petición. U simétrica, O/S más regulares, mayor peso de HOUSE, mejor separación y menos margen vacío. HOUSE mide196 unidades y PINK182 (7.69% de diferencia). SVG `viewBox="0 3 214 144"`, rojo#f11313 y transparencia. Introducción y footer adaptados a214/144; header64/52px y footer reducido al70% conservados. Comparación en `output/logo-refined/before-after.png`.
- Asistencia, agenda y entrada usan Inter, panel oscuro translúcido, bordes rojos y controles circulares. La navegación conserva su cápsula. Las dos imágenes de enlaces conservan exactamente sus archivos, dimensiones, recortes, transformaciones y filtros; los enlaces originales y el manejo del foco también se conservan.
- El título HALLOWEEN 2025 se conserva. Su texto ahora dice: «Tuvo que aprender a caminar para que HALLOWEEN 26 pudiera correr».
- Itinerario actualizado: película preparty «La venganza del charro negro» sin hora asignada; Inicio8:00pm, Dinámicas8:10pm, Piñata9:00pm, Concurso de disfraz9:20pm, Foto grupal9:40pm, Beer pong10:30pm, Batalla de Tilín insano11:30pm y Perreo intenso12:00am. Medianoche usa23 de octubre en el atributo de fecha. La descripción general también refleja estas actividades.

## Verificación

| Comprobación | Resultado | Evidencia |
| --- | --- | --- |
| Pruebas de física, presentación y video |41/41 | `npm test` |
| TypeScript y compilación final | Correctos | `npm run typecheck`, `npm run build` |
| Experiencia en siete viewports |407/407 | `output/globe-qa/final-development/report.json` |
| Versión compilada en escritorio y móvil |122/122 | `output/globe-qa/final-production/report.json` |
| GLSL en GPU con entradas controladas |18/18 | `output/globe-qa/shaders/report.json` |
| Recursos, fallos, resize y contexto |29/29 | `output/globe-qa/lifecycle/report.json` |
| Capa persistente y revelado |24/24 | `output/globe-qa/reveal/measurements.json` |
| Imágenes y comportamiento de modales |43/43 | `output/modal-qa/after.json` |
| Footer1440/499/390/320 |4/4 grupos | `output/footer-qa/local-measurements.json` |
| Revisión independiente del código | Sin defectos adicionales identificados | `output/globe-qa/final-review.md` |

La liberación de recursos se volvió a comprobar con el renderer definitivo. Modales y footer también se volvieron a comprobar en la versión compilada, con los mismos resultados. Las dos instancias de video activas cargaron completamente y avanzaron durante la reproducción; no hubo avisos ni errores de ejecución en producción. `git diff --check` también pasó.

La aplicación posterior del logo Entrada y la reducción del footer pasaron41/41 comprobaciones específicas en1440/499/390/320, además de typecheck y una nueva compilación correcta. Evidencia `output/entrada-applied/report.json`; PNG transparente804×504 `logo-entrada.png` en la misma carpeta. El shader no cambió; las cifras anteriores corresponden a su validación completa.

Entrada fue sustituido posteriormente por el tejado refinado. Este pasó revisión óptica independiente,8/8 comprobaciones de transparencia/contraformas y la revisión del footer en cuatro tamaños. El nuevo itinerario pasó21/21 comprobaciones también en la versión compilada (1440×900,390×844,320×568), incluyendo orden, horas, fechas, scroll y Escape. La compilación nueva es correcta. Las evidencias actuales de estas peticiones están en `output/logo-refined` y `output/itinerary-qa`.

Se entregan seis conceptos iniciales y ocho nuevas tipografías originales: Extendida, Redonda, Condensada, Bloque serif, Arquitectura, Trazo libre, Código y Editorial. La segunda tanda cambia las letras, pesos y proporciones; fue revisada a52,64 y100px. Cada propuesta incluye SVG y PNG transparente en rojo#f11313, sin dependencia de fuentes externas. Lámina `output/logo-typography/contact-sheet.png` y paquete `pink-house-new-typography.zip` en esa carpeta. Las opciones01 y03 encajan especialmente con el carácter editorial actual.

La matriz incluye320×568,390×844,844×390,768×1024,1024×768,1440×900 y1920×1080, cambios de orientación, Tab/Shift+Tab/Escape, asistencia, agenda, corte del ticket, carrusel, arrastre de mouse/touch, scroll vertical, teclado del globo, movimiento reducido, video, WebGL desactivado y recuperación del contexto. La pasada final se ejecutó con archivos estables; se repitió una pasada interrumpida por recargas de desarrollo.

El shader actual coincide porSHA256 con el módulo validado en una NVIDIA RTX3060 Laptop/ANGLE D3D11. En16,990,208 canales RGBA8 comparados,17 casos son idénticos; en el restante difiere un canal por1/255. Corona, composición y feedback secuencial son exactos con las entradas comunes. El ensayo compara el resultado real de GPU, no solo texto o fórmulas.

La comparación con Nike en vivo confirmó diámetros de624px en escritorio y365.04px en móvil y34/34 uniformes estáticos iguales enfloat32. Se conservan capturas de reposo, movimiento lento/rápido, persistencia y touch, más cuatro grabaciones, en `output/globe-qa/live-comparison`. La geometría de revelado coincide dentro de1px. Las fases temporales independientes impiden comparar todos los píxeles de dos páginas distintas directamente.

## Ingeniería y diferencias documentadas

Buffers512 en escritorio; perfiles móviles512/384/320; movimiento reducido256. DPR limitado a2 escritorio y1.5/1.2/1 móvil. El renderer pausa en pestaña oculta, libera geometrías, materiales, texturas, render targets, escuchas y observadores, y recupera el mismo canvas tras pérdida del contexto. La capa persistente continúa funcionando antes de alcanzar el footer.

Se corrigen los smoothstep descendentes indefinidos, se presenta la salida más reciente del feedback y se fija la recurrencia de corona a60Hz con recuperación limitada tras una demora. Nike muestrea un buffer fijo, alternando su actualización visible. La propia preferencia de movimiento reducido congela los efectos automáticos; Nike seguía animando su perfil ligero. En móvil la interacción se desbloquea al quedar asentado el globo, incluida la banda reservada del footer.

La geografía regional, textos, rojo#f11313 y logo son propios. No hay assets de Nike en la aplicación de producción. La fuente de verdad es el informe técnico y la evidencia pública de fuente/runtime conservada en la carpeta `nike-globe-investigation` indicada en la auditoría.

Las comprobaciones móviles usan emulación de Chrome; no se midió un teléfono físico ni equivalencia entre todos los drivers. Las tasas breves de envío de cuadros registradas con instrumentación y grabación no son un benchmark deGPU. El chunk del renderer es530.55kB minificado/136.57kB gzip y se importa por separado al montar la capa; el inicial es267.41kB/83.17kB gzip. Vite emite su aviso normal de chunk mayor de500kB.

No se desplegó, publicó, fusionó ni envió el trabajo a un servicio externo.
