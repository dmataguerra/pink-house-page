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

- **Sobre la noche:** el espíritu de The Pink House y de esta edición.
- **Los detalles:** fecha, disfraces, concurso, bebidas y cómo conseguir la ubicación.
- **Pedas anteriores:** cinco espacios, `PEDA 01` a `PEDA 05`, con nombres y recuerdos por completar.
- **Tu entrada:** abre el ticket de la momia desde el menú para descubrir el plan de la noche.
- **Juriquilla:** mapa 3D en video y esfera interactiva con UAQ, UVM, ENES y The Pink House.

La página incluye cuenta regresiva, navegación móvil, imágenes optimizadas y una alternativa de movimiento reducido. El ticket funciona con mouse, pantalla táctil y teclado.

## Una identidad que cambia de temporada

El diseño actual toma como referencia [Nike After Dark Tour — Ciudad de México](https://www.afterdarktour.nike.com/es/mexicocity), con contenido y fotografías propios. Combina fondo negro, naranja (`#ff641a`), una fotografía de fiesta con luz naranja/ámbar y una imagen de comunidad en blanco y negro, ambas con grano analógico visible. Los assets activos son `public/images/after-dark-party-grain.webp` y `public/images/after-dark-community-grain.webp`. El menú flotante, la cuenta regresiva y el archivo acompañan el recorrido. Las siguientes ediciones podrán cambiar su atmósfera conservando el nombre y la forma de encontrarnos.

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
| Hero, textos y composición principal | [`src/App.tsx`](src/App.tsx) |
| Menú y cuenta regresiva flotante | [`src/components/AfterDarkHeader.tsx`](src/components/AfterDarkHeader.tsx) |
| Pedas anteriores | [`src/sections/AfterDarkFAQ.tsx`](src/sections/AfterDarkFAQ.tsx) |
| Mapa de Juriquilla y footer | [`src/sections/AfterDarkClosing.tsx`](src/sections/AfterDarkClosing.tsx) |
| Reproducción del mapa 3D | [`src/components/AfterDarkLocation.tsx`](src/components/AfterDarkLocation.tsx) |
| Renderer del nuevo video | [`aerial/scripts/render-after-dark.ts`](aerial/scripts/render-after-dark.ts) |
| Fotos, ilustraciones y video | [`public/`](public/) |

Al cambiar de temática, revisa también los textos, las imágenes y los metadatos de `index.html`.

### Publicación

La publicación está preparada para **Cloudflare Pages**: conecta el repositorio, usa `npm run build` y publica la carpeta `dist/`. Cloudflare puede compilar automáticamente la rama seleccionada sin GitHub Actions. Consulta la [guía de publicación y dominio propio](docs/CLOUDFLARE.md).

El [workflow anterior de GitHub Pages](.github/workflows/deploy.yml) queda como alternativa manual. La dirección de Cloudflare es [pink-house-page.pages.dev](https://pink-house-page.pages.dev/).

## Documentación

- [Guía para colaborar](CONTRIBUTING.md)
- [Notas de implementación y continuidad](docs/CONTINUITY.md)
- [Identidad y uso de assets](docs/BRAND.md)
- [Fotografías y video del diseño After Dark](docs/AFTER_DARK_ASSETS.md)
- [Variante naranja final y prompt de edición](docs/ORANGE_PALETTE.md)
- [Cloudflare Pages y dominio propio](docs/CLOUDFLARE.md)

El código y los assets no tienen una licencia de reutilización abierta declarada. Consulta las notas de identidad antes de reutilizar material visual o tipográfico.

---

<p align="center">Hecho para las noches de The Pink House · © 2026 dmataguerra</p>
