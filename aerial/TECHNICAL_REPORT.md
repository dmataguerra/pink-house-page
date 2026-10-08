# Paseo de Libero 172 — technical report

Prepared 7 October 2026 (America/Mexico_City).

## Scope and result

The follow-up request explicitly accepts approximate, game-map-style buildings. The implemented default therefore uses an illustrated 3D neighborhood and an orbital Earth zoom. It does not require a private house survey, billing, or a Google API key. The final MP4 was rendered and validated on 7 October 2026.

The target remains 20.707390681241908, -100.44438633247219. The shared Maps link identifies Paseo de Libero 172, Juriquilla, Querétaro. Its place marker is approximately 15.7 m from the supplied coordinate; the explicit coordinate is retained.

## Geographic sources and permitted reuse

- **Natural Earth II**, bundled with Cesium, provides the globe-scale raster. Its map data is public domain: https://www.naturalearthdata.com/about/terms-of-use/ . It is not street-level satellite imagery.
- **OpenStreetMap**, downloaded as vector geometry through Overpass, provides roads, land use and mapped building outlines. The local snapshot contains 1,467 ways, including 144 building outlines and 1,229 highway ways. ODbL 1.0 applies; visible attribution and the copyright URL are retained: https://www.openstreetmap.org/copyright . No OSM rendered map tiles are captured or bulk-downloaded. One building has a height tag, whose measurement accuracy is not verified.
- **Microsoft Global ML Building Footprints** supplies an optional local extract of AI-detected footprints. The pinned catalog is dated 2026-08-13; this is not an imagery capture date. The dataset uses CDLA Permissive 2.0. The local source metadata includes its full license text, download URLs, source hashes and limitations. https://github.com/microsoft/GlobalMLBuildingFootprints and https://cdla.dev/permissive-2-0/ . Any provided height is an AI estimate; missing heights are rendered using an illustrative value.

The completed local Microsoft subset contains 1,291 footprints in the 1,400 m envelope and no supplied height estimates. No Microsoft polygon contains the supplied target coordinate; the nearest retained footprint is approximately 376.6 m away. The pink target volume in the output is therefore explicitly procedural and illustrative.

All geographic capture requests must remain on the local preview origin. Google tiles, screenshots and meshes are not used. The previous research into surveyed sources and Google export restrictions is preserved separately in SURVEYED_MODE_RESEARCH.md; its unavailable-survey status applies only to the optional surveyed mode.

## Appearance and accuracy

The coordinate marker identifies the requested location. The model uses simplified extruded footprints, flat illustrative roofs, approximate colors, estimated road widths and a flat local ground surface. Most heights use 6.4 m or mapped levels multiplied by 3.2 m. No roof slopes, façades, vegetation mesh, property boundaries or measured terrain are reconstructed. Missing outlines are not evidence that no building exists. AI footprints may merge houses or omit structures. Even a polygon containing the coordinate does not verify the correct house.

The video permanently displays “VISUALIZACIÓN APROXIMADA · ALTURAS ESTIMADAS” in the unobtrusive top-right credit, with the target label “Pink House”. Header coordinates and the former address label are omitted, as is the footer strip. Source and QA metadata explicitly record photorealistic=false, surveyedGeometryVerified=false and targetHouseReconstructionVerified=false.

## Camera and rendering

TypeScript / React / Vite / CesiumJS provide the interactive scene. The delivered MP4 uses the deterministic software illustration renderer in `scripts/render-software.ts`; it projects the same camera path and local vector structures into SVG frames, which avoids a browser localhost restriction while keeping the output reproducible. A deterministic camera samples integer frames at 30 fps. Cubic Hermite interpolation of logarithmic distance and camera angles preserves position and velocity continuity. The opening is approximately 22 million metres from the target; 0–3 s shows the Earth, 3–12 s descends, 12–15 s approaches, 15–28 s completes a full 360-degree orbit at a 220 m slant distance and 150 m height above the illustrative surface, and 28–30 s pulls back.

The edited renderer replays source frames 300–899 (the former 10-second point through the original end), creating 600 1920 × 1080 PNG frames. FFmpeg encoded H.264, yuv420p, 30 fps, 20 seconds. Output was published only after FFprobe, full decode, black/freeze detection, image metrics and per-frame coordinate/credit metadata passed; previous deliverables are backed up. Playwright/Cesium remains available for interactive preview and optional surveyed mode.

## Quality checks and their limits

The software test suite passes 32 tests. TypeScript and the production build pass. The final MP4 is 29,420,238 bytes. Three representative final frames were inspected; the encoded-video checks passed.

Every frame must keep the target coordinate in the safe frame and retain the approximation caption and source credits. Frame statistics reject black images, insufficient detail and excessive identical frames. FFprobe verifies the codec, pixel format, resolution, both frame rates, duration and 900 decoded frames. FFmpeg decodes the entire MP4 and checks encoded black/frozen sequences. These are technical and visual checks; they do not establish survey accuracy or house identity. The illustrated orbit remains above the modeled building heights, but no real-world collision or drone flight clearance is asserted.

Reproduction commands are in README.md and START_HERE.md. The source archive includes the small local open-data extracts and provenance, while excluding credentials, private surveys, installed dependencies and generated video.
