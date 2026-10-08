# Surveyed-mode feasibility research (historical)

This document records the stricter real-survey/Google feasibility research. It does not describe the delivered approximate cartographic MP4; see `TECHNICAL_REPORT.md` for the current output.

Research date: **7 October 2026**, America/Mexico_City.

**Status:** source code and an independent-data rendering pipeline are implemented. No licensed textured 3D survey covering the property has been obtained; no live property geometry has been verified; **`output/house_flyover.mp4` has not been produced or validated**. No Google 3D tiles were loaded or recorded. Software checks and future live-render results must be distinguished from completion of the requested video.

## Location and property identity

The user supplied `20.707390681241908, -100.44438633247219` and [this Google Maps short link](https://maps.app.goo.gl/LYGenKGTPA1pnLqaA). The resolved Maps place identifies Paseo de Libero 172 and a place center near `20.7072502, -100.4443756`. That point lies approximately 15.7 m from the supplied coordinates. The pipeline retains the user's explicit coordinates rather than silently replacing them with the place center.

The attachment identifies the circled roof cluster as the intended house. A top-down image cannot establish roof elevations, façades, survey accuracy or a complete building footprint. It is an identity reference and has not been converted into scene textures or fabricated geometry. Correct property identity still requires comparison with an actual georeferenced survey.

## Google coverage and export decision

Google describes its Photorealistic 3D Tiles as textured surface geometry. Its public coverage interface distinguishes worldwide terrain from 3D surfaces, which appear only in blue coverage areas. General availability in Mexico does not verify this house. The interactive target inspection could not be completed through the available map UI, and no API key was supplied for a direct tiles test. Exact property coverage remains **unverified**. [Product documentation](https://developers.google.com/maps/documentation/tile/3d-tiles), [official surface coverage interface](https://developers.google.com/maps/documentation/javascript/3d/coverage)

The current documented promotional-video exception requires an application-capability promotion, a maximum 30-second duration, the prescribed promotional marking and attribution, excludes Street View and separate resale, and requires honoring takedown requests. Duration alone does not make the requested residential flyover eligible. No separate written authorization was supplied. The pipeline consequently rejects Google-derived imagery for this export instead of recording it. It performs no Earth scraping, mesh extraction or API bypass. [Map Tiles API video policies](https://developers.google.com/maps/documentation/tile/policies#video-creation), [Google Maps Platform terms](https://cloud.google.com/maps-platform/terms/)

## Alternatives investigated

| Source | Verified offering and limitations | Present usability |
|---|---|---|
| INEGI | LiDAR surface elevation products include infrastructure and vegetation in 5 m grids. Free-use terms permit publication, adaptation and commercial derivatives with credits and transformation disclosure. | No photographically textured target-house mesh verified. A coarse surface grid cannot provide the requested façade/roof fidelity. |
| IMPLAN / UNAM | A 2018 municipal report documents drone photogrammetry and a detailed 3D model of the historic center. Page 2 restricts profit and uses beyond project purposes. | Neither exact-target coverage nor general video-export permission is established. Publicly accessible documentation is not an open data license. |
| Maxar / Vantor Vivid Terrain | Genuine 0.5 m equivalent-spacing surface mesh; Cesium 3D Tiles 1.0/1.1 delivery; minimum 10 km² order. Authenticated Discovery queries can check the target. Current legal portal lists a Display & Media add-on. | Exact coverage, current capture quality and applicable standalone-video rights remain unverified. Paid acquisition and contractual rights would be needed. |
| Nearmap | Surveyed 3D meshes and exports exist; exports require a subscription, permission and credits. | No exact-target coverage or video rights verified. |
| Commissioned local photogrammetry | Querétaro service providers document real 3D photogrammetry/textured-mesh delivery. | Requires a new survey or an existing owner-supplied survey and an explicit video license. No purchase or contact has been made. |

Primary sources: [INEGI surface specifications](https://www.inegi.org.mx/contenidos/temas/relieve/continental/doc/fichas_tecnicas.pdf), [INEGI free-use terms](https://www.inegi.org.mx/inegi/terminos.html), [IMPLAN official report](https://implanqueretaro.gob.mx/tr/a66/f40/2018/t3/a66f4010t318.pdf), [Vivid Terrain technical documentation](https://developers.maxar.com/docs/ordering/guides/3d-ordering), [Vantor current licenses](https://vantor.com/legal/), [Nearmap export requirements](https://help.nearmap.com/kb/articles/741-export-3d), [Nearmap coverage API](https://developer.nearmap.com/reference/coverage), [Geospectral photogrammetry](https://geospectral.com.mx/pages/topografia-y-fotogrametria), [AEC Technology reality capture](https://aec.technology/es/captura-de-la-realidad/).

No alternative was found with both **verified exact-property textured geometry and established export rights available in this session**. This is a research result, not proof that no such dataset exists. Satellite basemaps, terrain and guessed building extrusions were not used to impersonate the requested reconstruction.

## Implemented pipeline

The separate `aerial/` project uses TypeScript, React/Vite, CesiumJS, Playwright, FFmpeg and FFprobe. The source is restricted to surveyed photogrammetry or an independently licensed textured surface mesh. Its manifest names the provider, capture date, coverage, exact attribution, target ellipsoid height and the owner/operator's reviewed grant of export and distribution rights. The license text is retained privately and hashed for provenance. Manifest assertions and a text hash **do not automatically prove legal rights**.

Coverage must extend at least 900 m around the target. The maximum camera range is 800 m slant distance, about 668 m horizontally at its final height, with additional neighborhood margin. An accurate WGS84-georeferenced target ellipsoid height is required; the example value is not an elevation estimate.

The camera samples time as frame index divided by 30, with quintic easing and an unwrapped 360-degree orbit. It follows the requested five phases: establishing (0–5 s), approach (5–10 s), orbit (10–20 s), reveal (20–25 s) and pullback (25–30 s). Real data may require camera adjustment if geometry checks reject a pose.

Chromium captures 900 settled 1920 × 1080 frames. Credits are forced onscreen. The encoder writes H.264 / yuv420p, and publishes `output/house_flyover.mp4` only after successful checks. Capture requests for Google domains stop the render. Private data and credentials are ignored by Git. The frontend build still needs the local dataset API; the rendering script launches Vite to supply it.

## Verification and remaining limitations

Software verification completed on 7 October 2026:

- `npm install`: completed; Cesium, Playwright, FFmpeg and FFprobe dependencies installed with a lockfile.
- `npm run build`: TypeScript validation and production asset build passed.
- `npm test`: **29/29 tests passed**, including automatic browser selection, camera continuity/determinism, location parsing, rights/source gates, redirects, frame/image QA, real FFmpeg/FFprobe encoding/decoding of a one-second diagnostic test pattern, and rejection of black, frozen and corrupt diagnostic video. Diagnostic fixtures are temporary and are not property reconstructions.
- Browser smoke: passed at **1920 × 1080** using automatically selected installed Chrome through Playwright. The missing-manifest screen appeared, no 3D canvas was created and no external content was requested. The shared browser selector honors overrides, checks bundled Chromium and detects installed browsers; setup downloads Chromium only when none is available.
- Production `npm run render` without data: correctly failed before launching a browser or creating a capture run, lock or MP4. `output/house_flyover.mp4` is absent.
- Git ignores environment files, private license evidence, licensed dataset assets and generated output.

The follow-up setup command now prepares local templates and directories automatically, preserves existing configuration, and reuses dependencies matching the lockfile. `doctor` records software readiness separately from the missing property data. The portable source package contains the source and reproduction instructions; private configuration, license evidence, geographic assets and generated media are excluded.

The implemented live checks require loaded geometry and textures, 34 geographic height samples with at least 80% valid coverage and at least 2 m height variation, a target depth hit within 3 m of the sampled focal point, sampled camera clearance of at least 10 m, and attribution in every frame. Image measurements flag black/low-detail scenes and excessive exact duplicates. FFprobe validates resolution, codec, pixel format, both frame rates, duration and 900 decoded frames; FFmpeg performs complete decoding and encoded black/freeze checks. External redirects are rejected before they can lead to a disallowed source.

These checks have **not run against a real dataset of this property**. Height variation alone cannot distinguish buildings from terrain; a visible point cannot prove the entire correct house is visible; loaded texture bytes do not guarantee all textures are correct; sampled clearance does not detect every potential collision. The image tests are coarse heuristics. Geographic identity, provenance, texture fidelity and the final cinematic result require dataset and visual review.

The remaining essential input is an actual surveyed textured 3D dataset with independent permission to create and distribute this standalone video. The user has indicated that no such survey is currently available. The pipeline is prepared for that input; the MP4 deliverable remains incomplete.
