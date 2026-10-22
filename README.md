# The Pink House — Halloween 2026

<p align="center">
  <a href="https://pink-house-page.pages.dev/">Visitar The Pink House</a> ·
  <a href="https://www.instagram.com/david_mata_g/">Pedir ubicación</a> ·
  <a href="https://calendar.app.google/HCNWJHqhFCBNuWdn9">Confirmar asistencia</a>
</p>

<p align="center">Sitio oficial · React + Vite · Cloudflare Pages</p>

## La casa de siempre. Una noche diferente.

**The Pink House** es nuestra casa en internet: un lugar para conocer las próximas noches, descubrir lo que estamos preparando y confirmar tu asistencia. La identidad permanece; la temática cambia con cada edición.

Actualmente estamos en **modo Halloween**. Una noche de disfraces, música, juegos y pedas caseras con el estilo de The Pink House.

## Halloween 2026

| | Tu noche en la casa |
| :--- | :--- |
| Fecha | Jueves 22 de octubre de 2026 |
| Hora | Desde las 20:00, hora del centro de México |
| Disfraz | Recomendado, no obligatorio. Habrá concurso y premio al mejor. |
| Ubicación | Se comparte al confirmar. Puedes pedirla por Instagram. |
| Bebidas | Trae lo que te gusta tomar. También habrá bebidas de nuestra parte. |

**Lo que pasa en la Pink House se queda en la Pink House.**

## Explora la página

- **Inicio:** header flotante, animación de entrada original, THE PINK HOUSE / HALLOWEEN y confirmación de asistencia.
- **Cuenta regresiva:** horas totales, minutos y segundos hasta el 22 de octubre de 2026 a las 8:00 pm, hora del centro de México. Usa la fecha real y se mantiene en cero al llegar el evento.
- **Fecha y hora:** inicio a las 8:00 pm, visible debajo del contador.
- **Menú:** navegación a inicio, cuenta regresiva y fecha/hora; conserva asistencia, agenda, ticket de la momia e Instagram.

La página incluye cuenta regresiva, navegación móvil, imágenes optimizadas y una alternativa de movimiento reducido. El ticket funciona con mouse, pantalla táctil y teclado.

## Una identidad que cambia de temporada

El diseño toma como referencia [Nike After Dark Tour — Ciudad de México](https://www.afterdarktour.nike.com/es/mexicocity). La página simplificada conserva el fondo negro, rojo (`#f11313`), Inter Variable, header y animación de entrada de la versión publicada. El título y la asistencia preceden a un contador grande. Las fotografías del recorrido, secciones editoriales, video, archivo, globo y footer ya no se montan en la página; sus fuentes y assets se conservan. Consulta [la base desplegada y validación del rediseño](docs/HALLOWEEN_COUNTDOWN.md).

## Desarrollo local

Construido con React, TypeScript, Vite y GSAP. Usa Node.js 22.

```sh
npm ci
npm run dev
```

Abre la dirección indicada por Vite en la ruta `/`.

```sh
npm run typecheck
npm run build
```

### Actualizar una edición

| Contenido | Archivo |
| :--- | :--- |
| Fecha, hora, Instagram y asistencia | [`src/config/event.ts`](src/config/event.ts) |
| Hero, textos y composición principal | [`src/App.tsx`](src/App.tsx), [`src/components/EventLanding.css`](src/components/EventLanding.css) |
| Header flotante y menú | [`src/components/AfterDarkHeader.tsx`](src/components/AfterDarkHeader.tsx) |
| Animación de entrada | [`src/components/OpeningCollage.tsx`](src/components/OpeningCollage.tsx) |
| Cuenta regresiva | [`src/components/Countdown.tsx`](src/components/Countdown.tsx), [`src/lib/countdown.ts`](src/lib/countdown.ts) |
| Agenda y entrada | [`src/sections/NightSchedule.tsx`](src/sections/NightSchedule.tsx), [`src/components/MummyTicket.tsx`](src/components/MummyTicket.tsx) |
| Fotos, ilustraciones y video | [`public/`](public/) |

Al cambiar de temática, revisa también los textos, las imágenes y los metadatos de `index.html`.

### Publicación

La publicación está preparada para **Cloudflare Pages**: conecta el repositorio, usa `npm run build` y publica la carpeta `dist/`. Cloudflare puede compilar automáticamente la rama seleccionada sin GitHub Actions. Consulta la [guía de publicación y dominio propio](docs/CLOUDFLARE.md).

El [workflow anterior de GitHub Pages](.github/workflows/deploy.yml) queda como alternativa manual. La dirección de Cloudflare es [pink-house-page.pages.dev](https://pink-house-page.pages.dev/).

## Documentación

- [Guía para colaborar](CONTRIBUTING.md)
- [Notas de implementación y continuidad](docs/CONTINUITY.md)
- [Auditoría para retomar el globo y el diseño actual](docs/GLOBE_IMPLEMENTATION_AUDIT.txt)
- [Resultado final del globo, modales y footer](docs/GLOBE_IMPLEMENTATION_REPORT.md)
- [Identidad y uso de assets](docs/BRAND.md)
- [Fotografías y video del diseño After Dark](docs/AFTER_DARK_ASSETS.md)
- [Variante naranja final y prompt de edición](docs/ORANGE_PALETTE.md)
- [Cloudflare Pages y dominio propio](docs/CLOUDFLARE.md)

El código y los assets no tienen una licencia de reutilización abierta declarada. Consulta las notas de identidad antes de reutilizar material visual o tipográfico.

---

<p align="center">Hecho para las noches de The Pink House · © 2026 dmataguerra</p>
