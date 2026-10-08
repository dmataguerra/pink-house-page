# Paseo de Libero 172 — technical report

Updated 8 October 2026 (America/Mexico_City).

## Scope and result

The follow-up request explicitly accepts approximate, game-map-style buildings. The implemented default therefore uses an illustrated 3D neighborhood and an orbital Earth zoom. It does not require a private house survey, billing, or a Google API key. The final MP4 was rendered and validated on 7 October 2026.

The target remains 20.707390681241908, -100.44438633247219. The shared Maps link identifies Paseo de Libero 172, Juriquilla, Querétaro. Its place marker is approximately 15.7 m from the supplied coordinate; the explicit coordinate is retained.

## Geographic sources and permitted reuse

- **Natural Earth II**, bundled with Cesium, provides the globe-scale raster. Its map data is public domain: https://www.naturalearthdata.com/about/terms-of-use/ . It is not street-level satellite imagery.
- **OpenStreetMap**, downloaded as vector geometry through Overpass, provides roads, land use and mapped building outlines. The local snapshot contains 1,467 ways, including 144 building outlines and 1,229 highway ways. ODbL 1.0 applies; visible attribution and the copyright URL are retained: https://www.openstreetmap.org/copyright . No OSM rendered map tiles are captured or bulk-downloaded. One building has a height tag, whose measurement accuracy is not verified.
- **Microsoft Global ML Building Footprints** supplies an optional local extract of AI-detected footprints. The pinned catalog is dated 2026-08-13; this is not an imagery capture date. The dataset uses CDLA Permissive 2.0. The local source metadata includes its full license text, download URLs, source hashes and limitations. https://github.com/microsoft/GlobalMLBuildingFootprints and https://cdla.dev/permissive-2-0/ . Any provided height is an AI estimate; missing heights are rendered using an illustrative value.

The completed local Microsoft subset contains 1,291 footprints in the 1,400 m envelope and no supplied height estimates. Its nearest retained footprint is approximately 376.6 m from the target, so that subset alone left the center of the neighborhood incomplete.

- **Overture Maps Foundation**, release **2026-09-23.1**, supplies 15,903 open outlines within a 1,800 m envelope, including 719 within 350 m of the target. The stored subset includes per-feature source provenance and a SHA-256 checksum. Its merged building theme is ODbL 1.0, incorporating OpenStreetMap, Microsoft ML Buildings, and Google Open Buildings. The latter is an independently published CC BY 4.0 vector dataset, not Google Maps tiles or imagery. Source and licensing: https://docs.overturemaps.org/getting-data/cloud-sources/ and https://docs.overturemaps.org/attribution/#buildings .

The current scene retains 15,934 structures after preferring mapped OSM outlines/heights and removing 1,404 duplicate provider footprints: 144 OSM, 15,759 Overture and 31 additional Microsoft footprints. The neighborhood now uses **zero procedural buildings**. The target footprint's shape comes from the open outline rather than an invented rectangle; its height and property identity remain unverified.

All geographic capture requests must remain on the local preview origin. Google tiles, screenshots and meshes are not used. The previous research into surveyed sources and Google export restrictions is preserved separately in SURVEYED_MODE_RESEARCH.md; its unavailable-survey status applies only to the optional surveyed mode.

## Appearance and accuracy

The coordinate marker identifies the requested location. The model keeps the dark gray map style while preserving mapped roof outlines and building setbacks. Streets use supplied widths/lanes where present, otherwise estimated widths in metres; all widths recede in the same perspective as the buildings. Mapped parks, gardens and campus surfaces remain clear. Structures are drawn in camera depth order with visible wall faces, directional shading, subtle floor joints and ground shadows. JURIQUILLA is centered horizontally.

Roofs are flat extrusions and most heights remain estimated: mapped height first, mapped floors × 3.2 m next, then a building-type fallback. No photographic façades, roof slopes, vegetation mesh, property boundaries or measured terrain are reconstructed. Missing outlines are not evidence that no building exists. AI footprints may merge houses or omit structures. Even a polygon containing the coordinate does not verify the correct house.

The video displays source attribution unobtrusively at the lower edge and the target label “Pink House”. Header coordinates and the former address label are omitted. Source and QA metadata retain “VISUALIZACIÓN APROXIMADA · ALTURAS ESTIMADAS” and explicitly record photorealistic=false, surveyedGeometryVerified=false and targetHouseReconstructionVerified=false.

## Camera and rendering

TypeScript / React / Vite / CesiumJS provide the interactive scene. The delivered MP4 uses the deterministic software illustration renderer in `scripts/render-software.ts`; it projects the same camera path and local vector structures into SVG frames, which avoids a browser localhost restriction while keeping the output reproducible. A deterministic camera samples integer frames at 30 fps. Cubic Hermite interpolation of logarithmic distance and camera angles preserves position and velocity continuity. The opening is approximately 22 million metres from the target; 0–3 s shows the Earth, 3–12 s descends, 12–15 s approaches, 15–28 s completes a full 360-degree orbit at a 220 m slant distance and 150 m height above the illustrative surface, and 28–30 s pulls back.

The edited renderer replays source frames 300–899 (the former 10-second point through the original end), creating 600 1920 × 1080 PNG frames. FFmpeg encoded H.264, yuv420p, 30 fps, 20 seconds. Output was published only after FFprobe, full decode, black/freeze detection, image metrics and per-frame coordinate/credit metadata passed; previous deliverables are backed up. Playwright/Cesium remains available for interactive preview and optional surveyed mode.

## Quality checks and their limits

The software test suite passes 36 tests, including footprint deduplication, road widths, mapped surfaces, centered title and the narrow distinction between licensed Open Buildings vectors and prohibited Maps imagery. TypeScript passes. Four representative preview frames and a frame decoded from the final MP4 were inspected. The complete 600-frame video passed image metrics, FFprobe, full decode and black/freeze checks. The published website asset is 30,088,912 bytes and matches the validated export's SHA-256 hash.

Every frame keeps the target coordinate in the safe frame. Frame statistics reject black images, insufficient detail and excessive identical frames. FFprobe verifies the codec, pixel format, resolution, both frame rates, duration and 600 decoded frames for this 20-second edit. FFmpeg decodes the entire MP4 and checks encoded black/frozen sequences. These are technical and visual checks; they do not establish survey accuracy or house identity. The illustrated orbit remains above the modeled building heights, but no real-world collision or drone flight clearance is asserted.

Reproduction commands are in README.md and START_HERE.md. The source archive includes the small local open-data extracts and provenance, while excluding credentials, private surveys, installed dependencies and generated video.
