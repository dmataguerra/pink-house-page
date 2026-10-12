# The Pink House: After Dark photographs

Two original photographs generated with the built-in `image_gen` tool for this Halloween landing page. They are original scenes with adult subjects, no commercial logos, and no readable text. The referenced Nike page supplied visual direction only; its photographic assets were not reused.

| Web asset | Dimensions | Size | Original archive |
| --- | --- | --- | --- |
| `public/images/after-dark-party-original.webp` | 1254 × 1254 | 111,266 bytes | `output/art-reference/after-dark/after-dark-party-original.png` |
| `public/images/after-dark-community-original.webp` | 1254 × 1254 | 151,324 bytes | `output/art-reference/after-dark/after-dark-community-original.png` |

WebP assets use quality 88 and preserve the generated composition and dimensions. Original PNGs remain archived outside the public directory. Both outputs were inspected visually before integration.

## Final prompt: party

```text
Use case: photorealistic-natural
Asset type: original square editorial photograph for a Halloween house party website, 1024 x 1024 square.
Primary request: candid documentary photo of fully clothed Mexican adults around 30 years old dancing at a Halloween house party. A woman in a loose black t-shirt with subtle Halloween makeup is the main subject, photographed head and shoulders in profile with her face tilted upward. Another adult's raised hand enters at the top edge. All clothing is casual and fully covering.
Scene/backdrop: busy dark indoor home with friends wearing simple Halloween costumes and t-shirts, nearly black background.
Style/medium: authentic 35mm analog photograph, direct flash, coarse visible film grain, spontaneous imperfect framing.
Composition/framing: tightly cropped head-and-shoulders square portrait, woman's tilted face near center.
Lighting/mood: monochromatic saturated red light and red flash against deep black shadows, entire image red and black. Energetic celebration and friendship.
Constraints: original people and scene, anatomically natural, all adult subjects. No text, logos, watermarks, sports equipment, or recognizable commercial brands.
```

## Final prompt: community

```text
Use case: photorealistic-natural
Asset type: original square editorial photograph for The Pink House Halloween community website, 1024 x 1024 square.
Primary request: powerful documentary photograph of a group of Mexican adult friends around 30 years old bringing their hands together in a stacked gesture of friendship at a Halloween house party.
Scene/backdrop: dark indoor home at night, cropped group visible only as their forearms, casual black t-shirts and Halloween costume sleeves.
Subject: five adult hands and forearms gathered together in the center, one simple ring and generic bracelets, diverse skin tones rendered in monochrome.
Style/medium: authentic black and white 35mm analog flash photograph, raw grain, very high contrast, deep black shadows, bright skin highlights, candid editorial aesthetic.
Composition/framing: extremely tight overhead square crop of the hands, forearms diagonally emerging from edges, dark cloth filling negative spaces. All hands anatomically correct and distinguishable.
Lighting/mood: stark direct camera flash, nostalgic nighttime party community.
Constraints: original scene; no text, no logos, no watermarks, no sports imagery, no runners, no commercial brands.
```

## Juriquilla 3D map video

- Video: `public/videos/pink-house-after-dark.mp4` — 17 seconds, 1280 × 720, 30 fps, 510 frames, H.264/yuv420p, silent, MP4 faststart; 12,014,590 bytes. The first 3 seconds of the prior orange version were removed with an accurate decode and re-encode at CRF 18.
- Poster: `public/images/pink-house-after-dark-preview.webp` — 164,066 bytes, WebP quality 90, extracted from the source frame at 3 seconds, which is the trimmed video's new first frame.
- Renderer: `aerial/scripts/render-after-dark.ts`, using the existing SVG 3D geometry renderer in `render-software.ts`. Its default vector palette is now orange (`#ff641a`); `--purple-source` reproduces the intermediate purple palette. No image generation, photographic texture, new software, external browser, or new data fetch was used for this video.
- The delivered video uses the validated purple intermediate, recolored to the user's final orange request with `aerial/scripts/grade-after-dark-orange.ts`. FFmpeg filter `hue=h=90:s=1.2` was selected after visually comparing +90 and +100 degree test frames; +90 gives the stronger orange requested. This changes video color only and preserves white labels, charcoal geometry, camera, locations, and timing. The original purple MP4 is archived in `output/after-dark-video-purple/pink-house-after-dark-purple.mp4`.
- Same local camera path and framing as the existing local flyover, original source frames 300–899. Original `public/videos/pink-house.mp4` is preserved.
- Final palette: dark charcoal ground/buildings, intense orange and amber streets/outlines, white campus labels/rings. Page/vector identity accent: `#ff641a`.
- Existing OpenStreetMap, Overture Maps, and Microsoft Global ML Building Footprints data in `aerial/public/open-data/`; 15,935 building volumes and 1,229 roads. Heights are mainly estimated. The large ENES volume remains an illustrative landmark; the individual house reconstruction is not verified.
- Dataset attribution remains visible in the video. Final orange sample captures, encoding manifest, and QA report are in `output/after-dark-video-orange/`; source metadata and licenses are retained in `output/after-dark-video-purple/`. The complete 20-second orange version, original poster, and original reports are preserved as `full-20s.mp4`, `poster-full-20s.webp`, `qa-full-20s.json`, and `manifest-full-20s.json`. The source renderer now starts at source frame 390, emits 510 frames, and uses versioned `v2-start390-17s` work directories. Earlier captures remain outside public output.

| Point retained | Latitude | Longitude |
| --- | --- | --- |
| Pink House | 20.707390681241908 | -100.44438633247219 |
| UAQ (formerly FIF label) | 20.70438308336931 | -100.44387705896915 |
| UVM | 20.70827004638903 | -100.4453510329209 |
| ENES | 20.705875489620908 | -100.44812312985161 |

Verification passed: the new initial poster was inspected for the dark orange palette, campus labels, building extrusions, and the single Pink House marker. FFprobe frame counting and complete decoding confirmed 1280 × 720, 510 frames, 30 fps, exactly 17 seconds, H.264/yuv420p, no audio, and no decoding errors. MP4 atom inspection confirmed faststart ordering. Results: `output/after-dark-video-orange/qa.json`; full metadata: `probe-trim-17s.json` in the same directory. The previous 20-second QA is retained as `qa-full-20s.json`.

## Community photograph: visible analog grain

Final asset: `public/images/after-dark-community-grain.webp` — 1254 × 1254, WebP quality 92, 421,524 bytes. Edited with the built-in `image_gen` tool from `public/images/after-dark-community-original.webp`; the earlier original remains unchanged. The edit's original PNG is archived at `output/art-reference/after-dark/after-dark-community-grain.png`.

The final image was inspected at original size, 600px, and 345px. It retains the stacked hand gesture, composition, costume sleeves and monochrome palette, with a stronger matte 35mm grain texture visible at the intended desktop and mobile sizes. Format conversion and reduced QA previews use Pillow; the texture edit itself uses the built-in image tool.

Final edit prompt:

```text
Use case: style-transfer
Asset type: square black-and-white documentary photograph for The Pink House Halloween website.
Input images: Image 1 is the edit target. Preserve its photographic content exactly.
Primary request: Change only the analog film surface texture of the supplied photograph. Add clearly visible coarse organic 35mm ISO 1600 direct-flash film grain, with rough matte dark shadow texture and high contrast, like a raw nighttime music or community documentary photograph.
Texture: strong authentic irregular luminance grain, clustered roughly 3–5 pixels in size at a 1254px square output. It must remain conspicuously visible when the photograph is displayed at 600px desktop width and 345px mobile width. Grain should live naturally in skin midtones and matte charcoal shadows, with deep rich blacks, without looking like uniform digital noise.
Invariants: preserve every hand, each finger's anatomy, the exact stacked hand gesture, forearm shape and placement, tattoos, rings, bracelets, costume sleeves, candles and background, camera angle, original lighting direction, framing, crop, square aspect ratio, and original black-and-white monochrome palette. Do not add, remove, redraw, deform, or recompose any object or person.
Avoid: any color or tint, skin smoothing, pristine stock-photo finish, fine invisible grain, text, logos, watermark, new objects, scratches or borders. Only increase film grain and matte photographic texture.
```
