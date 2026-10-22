# Halloween: página simplificada

## Base verificada

Rama `codex/halloween-countdown`, creada desde `origin/main` en `35a10bdc1833b7e6890e15ecca7a0569f319b843`. La API de Cloudflare confirmó este mismo commit de `main` como despliegue canónico exitoso de `pink-house-page.pages.dev`. Se revisó la web publicada antes de editar.

La implementación vive en un worktree aislado. No utiliza los cambios locales pendientes del checkout principal, incluyendo el hero de boleto y su contador simulado.

## Experiencia

La página conserva `OpeningCollage`, el header flotante original, el logo publicado, la paleta negra/roja y la composición THE PINK HOUSE / HALLOWEEN con su botón de asistencia. Debajo muestra un único contador grande de horas totales, minutos y segundos y la fecha con INICIO 8:00 PM, hora del centro de México.

El destino es `2026-10-22T20:00:00-06:00` (`2026-10-23T02:00:00Z`), independiente de la zona horaria del visitante. Se recalcula desde el reloj al volver a la pestaña o recargar; no reinicia y se limita a cero después del inicio.

El menú navega a `#top`, `#countdown` y `#event-start`. Conserva los modales de asistencia, agenda y ticket interactivo, más Instagram. Se retiran los enlaces a secciones eliminadas. Las fotografías, secciones editoriales, video, archivo, globo, footer y barra inferior no se montan en el recorrido; sus fuentes y assets permanecen disponibles.

## Validación

- `npm run typecheck`, `npm test` (47 pruebas) y `npm run build`: correctos.
- Las seis pruebas nuevas cubren destino y zona horaria, horas totales superiores a 24/99, transiciones, fracciones de segundo, recarga y cero al vencer.
- Navegador sobre el build: 320 × 568, 390 × 844, 768 × 1024, 1266 × 712 y 1440 × 900. Sin desbordamiento horizontal; contador y hora de inicio dentro de la primera pantalla en esos tamaños.
- Navegación a la cuenta regresiva y existencia de todos los destinos del menú; apertura de asistencia desde el menú; enlaces originales de Instagram y calendario presentes.
- Apertura y cierre de agenda y ticket; Enter en las tijeras abre el plan; Escape cierra el modal y devuelve el foco al menú.
- El header y la animación de entrada originales conservan su comportamiento para movimiento reducido.

## Capturas del build

El contador refleja el momento de la captura y continúa actualizándose en la web.

![Escritorio](images/halloween-countdown-desktop.jpg)

![Móvil](images/halloween-countdown-mobile.jpg)
