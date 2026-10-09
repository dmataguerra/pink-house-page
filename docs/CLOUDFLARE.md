# Publicar The Pink House en Cloudflare Pages

La web es estática: React, TypeScript y Vite generan la carpeta `dist/`. RSVP abre los destinos existentes; countdown, navegación, modales y ticket funcionan en el navegador. Una única Pages Function sirve el MP4 con respuestas HTTP Range para conservar la continuidad al ampliar el reproductor y permitir avanzar en el video.

## Integración con GitHub

En Cloudflare, crea una aplicación **Pages** con integración Git y selecciona `dmataguerra/pink-house-page`.

| Ajuste | Valor |
| :--- | :--- |
| Framework | React / Vite |
| Carpeta raíz | Raíz del repositorio |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js | `22` (también declarado en `.node-version`) |

La rama que contiene la versión completa y la migración es `codex/cloudflare-pages`. Puede publicarse como rama de producción inicial sin fusionarla. Cuando se apruebe su integración a `main`, cambia la rama de producción de Cloudflare a `main`.

Cloudflare compila y publica los cambios de la rama de producción; otras ramas pueden generar previews. No necesita GitHub Actions. El workflow anterior de GitHub Pages queda disponible únicamente para ejecución manual y usa `npm run build:github` para conservar su ruta antigua.

## Validación local de producción

```sh
npm ci
npm run build
npm run preview
```

Abre `http://localhost:4173/`. Las rutas del build actual parten de `/`, compatible con una dirección `pages.dev` y con un dominio propio. Las imágenes y el MP4 usan `import.meta.env.BASE_URL`.

`public/_headers` configura caché prolongada para los bundles con hash y cabeceras básicas. Las imágenes sin hash conservan la política normal de Cloudflare para que una actualización no quede retenida durante un año.

## Reproducción del MP4

`functions/videos/pink-house.mp4.js` obtiene el archivo original mediante `env.ASSETS` y entrega respuestas `206` con `Content-Range` y `Accept-Ranges`. Transmite los bytes sin cargar el archivo completo en memoria. `public/_routes.json` limita las invocaciones a ese MP4; el resto de la web conserva el servicio estático. No requiere una base de datos, almacenamiento adicional ni plan de pago. Las solicitudes del video usan la cuota gratuita de Pages Functions.

Las pruebas del protocolo se ejecutan con `node --test tests/video-range.test.mjs`. Comprueba también el reproductor ampliado sobre la dirección publicada: Vite local soporta Range y no reproduce por sí solo la limitación del servidor estático de Pages.

## Dominio propio

El proyecto de Cloudflare se llama `pink-house-page` y su dirección gratuita es **https://pink-house-page.pages.dev/**. Usa esa dirección mientras no haya un dominio propio registrado y autorizado. La preferencia actual es `www.pinkhouse.mx`, únicamente si no requiere pago: el registro de `pinkhouse.mx` es de pago y no está autorizado comprarlo. Conectar un dominio que ya se posee no sustituye su registro ni renovación.

Después de comprobar la dirección `pages.dev`, entra al proyecto en **Custom domains → Set up a custom domain** y añade el dominio confirmado por el propietario.

- Para el dominio raíz, la zona debe estar en la misma cuenta de Cloudflare y usar sus nameservers.
- Para un subdominio con DNS externo, primero añádelo en Pages y después configura un CNAME hacia la dirección `pages.dev` real del proyecto.
- Conserva los registros de correo y otros servicios existentes; no sustituyas registros que no pertenezcan a esta web.
- Comprueba que el estado del dominio sea Active, HTTPS funcione y la web cargue sus imágenes, fuentes y video.

No se compra un dominio ni se cambia DNS hasta conocer el dominio elegido y su registrador. La migración no requiere contratar un plan de pago.

Documentación oficial: [integración Git](https://developers.cloudflare.com/pages/configuration/git-integration/), [dominios propios](https://developers.cloudflare.com/pages/configuration/custom-domains/), [límites](https://developers.cloudflare.com/pages/platform/limits/).
