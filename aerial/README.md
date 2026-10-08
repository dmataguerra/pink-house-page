# Paseo de Libero — orbital 3D video

The default mode now makes the simplified animation requested in the follow-up: it starts at the map-rendering point from the earlier preview, keeps the approach/orbit movement, and identifies the target as **Pink House**. It uses CesiumJS, open geographic outlines and illustrative building heights. No API key, billing account or private property survey is needed for this mode.

The model is a stylized 3D map, not a verified house reconstruction. The coordinate is accurate to the supplied target; building outlines can be incomplete or inferred, heights and road widths are approximate, and the local ground has no measured terrain relief. The permanent caption identifies the approximation.

## Generate the MP4

The source package includes a small local geographic extract and its provenance. From the folder containing `aerial/`:

```powershell
powershell -NoProfile -File .\aerial\setup.ps1
npm --prefix aerial run render
```

The default software renderer publishes `output/house_flyover.mp4` after checks: **1920 × 1080, 30 fps, 20 seconds, H.264/yuv420p**. It uses source frames 300–899 from the original 30-second camera path, so playback begins at the former 10-second point. The header has no coordinates, the label is “Pink House”, and the video footer is empty; the small top-right source credit remains for attribution. It also saves `.manifest.json` and `.qa.json` sidecars. Rendering takes longer than playback. Existing final outputs are preserved as backups. Keep several GB free for the 600 intermediate PNG frames. The delivered MP4 was rendered and validated successfully.

Preview four still frames with `npm --prefix aerial run render -- --preview`. For an interactive preview, run `npm --prefix aerial run dev` and open [the illustrated scene](http://127.0.0.1:4175/?mode=illustrated).

The source camera is deterministic: 0–3 s orbital view, 3–12 s logarithmic descent, 12–15 s arrival, 15–28 s full orbit, 28–30 s pullback. The delivered edit starts at source frame 300 (10 s) and ends at source frame 899. OpenStreetMap roads and building outlines, optional Microsoft AI building footprints, and the bundled Natural Earth globe are read locally during capture. Microsoft heights, where present, are model estimates; otherwise buildings use an explicit illustrative height of 6.4 m (or mapped floor count × 3.2 m).

`scripts/render-software.ts` makes the final frames directly from deterministic SVG projections, so it does not need a browser or a network connection during capture. `scripts/render-illustrated.ts` remains the Cesium/Playwright browser renderer for interactive experimentation; the optional surveyed mode uses its stricter measured-geometry checks.

To refresh the geographic extracts rather than use the included snapshot:

```powershell
npm --prefix aerial run fetch:open
npm --prefix aerial run fetch:buildings
```

The Microsoft download can be substantially larger than the final clipped extract. It is optional but gives much better residential coverage. Fetching requires internet; capture blocks all external requests. Natural Earth is public domain, OSM is ODbL 1.0, and the Microsoft extract includes its CDLA Permissive 2.0 text and source. See `public/open-data/` and [TECHNICAL_REPORT.md](./TECHNICAL_REPORT.md).

Recheck an existing illustrated or surveyed export:

```powershell
npm --prefix aerial run qa -- --video ../output/house_flyover.mp4 --manifest ../output/house_flyover.manifest.json
```

## Optional surveyed mode

The original higher-fidelity workflow remains available by setting `FLYOVER_MODE=surveyed` in `aerial/.env.local`. **Only this optional mode requires the private dataset and license evidence described below.** Leave the mode unset or use `FLYOVER_MODE=illustrated` for the ready-to-render simplified animation. `doctor`, `preflight` and the missing-data smoke test describe the surveyed source; their missing-survey report does not prevent illustrated rendering.

The target is `20.707390681241908, -100.44438633247219`, in Juriquilla, Querétaro, Mexico. The supplied coordinates remain authoritative. See [TECHNICAL_REPORT.md](./TECHNICAL_REPORT.md) for location uncertainty, coverage research, licensing and verification limits.

Google's documented video exception concerns application promotional videos with several conditions; a 30-second property flyover does not establish eligibility. This pipeline therefore accepts independently licensed data and blocks Google content during capture. [Official Map Tiles API policies](https://developers.google.com/maps/documentation/tile/policies#video-creation)

## One-command setup

Use Node.js 22 or later. Open PowerShell in the project folder containing `aerial/`. The same layout is included in `output/house_flyover_source.zip`. Run:

```powershell
powershell -NoProfile -File .\aerial\setup.ps1
```

Setup installs dependencies with `npm ci` when the installed versions differ from the lockfile, initializes the local configuration, checks Node/FFmpeg/FFprobe/H.264, and runs tests, the build and a browser smoke check. It preserves existing environment, dataset and license files. Repeating the command does not grant data rights or overwrite your settings.

Browser selection honors `CHROMIUM_PATH`, then checks Playwright's bundled Chromium, installed Chrome, and installed Edge. If none is available, setup downloads Chromium. This machine uses installed Chrome. Smoke and rendering both read `.env.local` and use the same browser selection.

The first dependency installation requires internet access. Rendering retains 600 full-resolution PNG frames for the current edit, so allow several GB of free space. If encoder downloads fail, set `FFMPEG_PATH` and `FFPROBE_PATH` in `.env.local` to existing executables. To force a fresh locked dependency installation, rerun setup with `-ReinstallDependencies`.

Software and data readiness are recorded separately in `output/verification/setup-status.json`. Check them again with:

```powershell
npm --prefix aerial run doctor
```

The browser smoke check uses an intentionally missing manifest, rejects external requests and saves `output/verification/missing-data.png`; it never produces a property video. Run it separately with `npm --prefix aerial run smoke`. Recheck the Maps redirect with `npm --prefix aerial run resolve:location`.

## Supply a real dataset and its rights

Obtain a georeferenced, photographically textured 3D Tiles survey containing this house and neighborhood. It must include actual measured building and roof geometry. A terrain model, satellite image, inferred footprint extrusion or unrelated sample mesh does not satisfy the task.

The manifest requires coverage extending at least **900 m from the target in every direction**. This covers the camera positions plus a margin; wider coverage may be needed to prevent survey edges appearing in the views. Supply the target's actual **WGS84 ellipsoid height**, in metres, consistent with the survey's georeferencing. Do not use the example height or substitute an orthometric elevation without converting its vertical reference.

Setup has already prepared `aerial/.env.local`, `aerial/private/dataset.json` and `aerial/public/data/` on this machine. A fresh copy gets the same folders and templates when you run setup. The manifest intentionally has no export permission. No license evidence or actual property geometry is invented by setup.

Copy the survey's complete 3D Tiles tree, including its geometry and textures, to `aerial/public/data/`, with the entry file at `aerial/public/data/tileset.json`. Keep relative asset references intact. An HTTPS tileset endpoint may also be used when its access and use are licensed for this purpose. External HTTP redirects are rejected before following them; use direct licensed endpoints for every tile, texture and credit image.

Edit `aerial/private/dataset.json` with the actual provider, capture date, provenance, geographic coverage, measured target height and exact required attribution. Store the actual written grant or applicable license text in `aerial/private/license.txt`. The `license.evidenceFile` path is relative to the manifest, so `./license.txt` refers to that private file.

The dataset owner or authorized operator must review the terms and record the relevant clause/reference, their name and review date. Set `standaloneVideoExport` and `videoDistribution` to `true` only when those rights actually exist. The example intentionally fails validation. A complete manifest and evidence hash record an operator's review; they cannot prove ownership or determine the legal meaning of a contract automatically.

`.env.local` should contain:

```dotenv
DATASET_MANIFEST=./private/dataset.json
```

Environment files, `private/` and `public/data/` are ignored by Git. Never commit API keys, signed dataset URLs, licensed meshes or private contracts. An endpoint's access token must reach the local browser to load tiles; use a suitably scoped credential and do not publish the local application or its configuration.

## Preview and render a supplied survey

```powershell
npm --prefix aerial run preflight
npm --prefix aerial run dev
```

Open [the local preview](http://127.0.0.1:4175). Inspect the target roof against the supplied reference, the neighborhood, texture quality, credits and survey extent. The camera uses establishing, approach, full orbit, neighborhood reveal and pullback phases over 30 seconds. Stop the preview with Ctrl+C when finished.

Render with:

```powershell
npm --prefix aerial run render
```

The rendering command starts its own local Vite server and Chromium. It loads and checks the tiles, samples geographic surface heights, then waits for loading and rendering to settle at each deterministic camera pose. It captures 900 frames at 1920 × 1080 and encodes 30 fps H.264 / yuv420p. Capture can take much longer than the video's duration.

Required dataset attribution and Cesium credits remain visible. If data fails to load, Google content is requested, the target is offscreen/occluded, clearance is insufficient or QA fails, the command stops. It publishes the final MP4 only after successful validation and preserves any previous final output as a timestamped backup.

Successful output files are at the repository root:

- `output/house_flyover.mp4`
- `output/house_flyover.manifest.json`
- `output/house_flyover.qa.json`

Per-run frames and failure diagnostics are retained under `output/.render-*`. Recheck a completed export with:

```powershell
npm --prefix aerial run qa -- --video ../output/house_flyover.mp4 --manifest ../output/house_flyover.manifest.json --report ../output/house_flyover.qa.json
```

The build command checks TypeScript and produces the frontend bundle. That bundle still requires the `/api/dataset` configuration endpoint; it is not a standalone production deployment. The supported capture command launches the local Vite endpoint itself.

## What the checks establish

FFprobe checks resolution, both frame rates, codec, pixel format, duration and decoded frame count; FFmpeg decodes the complete video. Per-frame diagnostics check loaded geometry/textures, target projection and depth occlusion, at least 10 m sampled camera clearance, and visible attribution. Coarse image metrics detect nearly black scenes, insufficient detail and excessive identical frames.

The live geometry test samples 34 locations and requires at least 80% valid samples and a surface-height range of at least 2 m. These are useful failure checks, **not conclusive proof of surveyed buildings or correct house identity**. Texture-byte and image metrics cannot detect every missing or incorrect texture. Sampled clearance cannot prove collision freedom against every mesh feature. Review the actual dataset and resulting video before treating it as an accurate property depiction.

## Portable source package

The archive `output/house_flyover_source.zip` contains `aerial/`, a root `START_HERE.md` and `output/.gitignore`. Keep that structure after extraction so video output stays within the extracted project. The accompanying `.sha256` file records the archive checksum.

The archive includes the open vector extracts and their public provenance/license records. It excludes installed dependencies, build output, environment secrets, private license documents, survey assets, screenshots and videos. Rebuild it from the project folder with:

```powershell
npm --prefix aerial run source:package
```

Previous source archives are preserved as uniquely named backups. The package command verifies its entries before publishing the archive. A new machine needs Node 22+ and internet for dependency installation. A real survey is needed only for the optional surveyed mode.

## Source layout

- `src/`: React/Cesium scene, fixed target, frame-based camera and browser capture API.
- `server/dataset.ts`: manifest, source, coverage and evidence validation.
- `scripts/preflight.ts`: configuration/evidence check before live rendering.
- `setup.ps1` and `scripts/doctor.ts`: local initialization and software/data diagnostics.
- `server/browser.ts`: shared installed/bundled browser selection.
- `scripts/render.ts`: Chromium capture, encoding and publication after QA.
- `scripts/render-software.ts`: deterministic local SVG/3D illustration capture used by the default mode.
- `scripts/render-illustrated.ts`: Cesium/Playwright illustrated browser capture.
- `src/illustrative-buildings.ts`: reproducible GTA-map-style procedural house volumes, labeled as assumptions.
- `scripts/qa.ts`: frame, image and decoded-video checks.
- `tests/`: deterministic camera and validation behavior checks.
- `.env.example` and `dataset.example.json`: configuration templates that grant no data rights.
