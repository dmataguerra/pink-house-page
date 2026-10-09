# Colaborar en The Pink House

Cada edición puede cambiar de temática; la información del evento y sus funciones deben seguir siendo claras y confiables.

1. Crea una rama desde `main` y describe la mejora concreta.
2. Instala dependencias con `npm ci` y revisa con `npm run dev`.
3. Conserva RSVP, countdown, navegación, video y ticket interactivo.
4. Ejecuta `npm run typecheck` y `npm run build`.
5. Abre un PR con resumen y capturas si el cambio es visual.

Comprueba escritorio y móvil, incluyendo 320px y 390px: legibilidad, botones táctiles, ausencia de scroll horizontal y navegación por teclado. Prueba modales con Escape, cierre y retorno del foco, y el modo de movimiento reducido.

Usa imágenes optimizadas y títulos HTML. No añadas direcciones privadas, credenciales ni material sin derechos de uso confirmados.

La configuración central está en `src/config/event.ts`; algunos textos editoriales están en los componentes y requieren revisión al cambiar de edición. Confirma fechas, horarios y enlaces con el organizador.

La publicación se realiza mediante GitHub Pages. Publicar o fusionar una propuesta requiere autorización del responsable del proyecto.
