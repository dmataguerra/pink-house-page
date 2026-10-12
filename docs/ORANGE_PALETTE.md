# The Pink House: orange and amber party photograph

The final active palette uses orange `#ff641a` over deep black, following the user's final color choice. The square party photograph is a lighting edit of the existing original The Pink House scene, created with the built-in `image_gen` tool. Its red illumination was replaced with orange and amber while preserving the people, Halloween makeup, poses, square composition, deep shadows, and photographic grain. It was visually inspected before saving.

| Artifact | Path | Dimensions | Size |
| --- | --- | --- | --- |
| Web asset, WebP quality 88 | `public/images/after-dark-party-orange.webp` | 1254 × 1254 | 144,072 bytes |
| Edited PNG archive | `output/art-reference/after-dark/after-dark-party-orange.png` | 1254 × 1254 | Original generated output |
| Edit target, preserved | `public/images/after-dark-party-original.webp` | 1254 × 1254 | 111,266 bytes |

The black-and-white community photograph remains unchanged. Previous red and purple artifacts remain archived as source variants; the orange variant is the final active image. No photographic scene from the Nike reference was reused.

## Final editing prompt

```text
Use case: lighting-weather.
Asset type: square editorial Halloween photograph for The Pink House website.
Input image: the supplied red photograph is the exact edit target.
Primary request: change ONLY the monochromatic red party illumination to warm orange and amber party illumination, with vibrant orange #ff641a as the dominant hue. Keep the same strong saturated monochromatic intensity and high contrast of the original red image, but use a natural warm orange rather than a glowing neon effect.
Preserve invariants: every person, facial identity and face detail, Halloween makeup, closed eyes, expression, hairstyle, clothing, pose, hands and fingers, jewelry, guests, environment, camera viewpoint, square framing, exact crop and composition, lighting direction, original exposure, deep noir black shadows, shadow placement, film grain and natural photographic texture. The woman's face stays tilted upward in the same central location; the raised hand stays at the upper-right edge.
Color palette: warm orange and amber light, deep black shadows. Replace all red light with unmistakably orange/amber light. No purple, violet, pink, magenta or red illumination remains.
Constraints: this is a lighting-color edit only. No new people or objects, no removal, no text, logos or watermarks, no beautification, no plastic skin, no scene, anatomy, camera or crop change. Retain original grain and deep black contrast.
```

## Final coarse film-grain variation

The user subsequently requested stronger visible photographic grain. The orange image was edited with the built-in `image_gen` tool to add organic coarse pushed-35mm texture and slightly stronger contrast, preserving the orange/amber palette, people, hands, poses, environment and square framing. The earlier source variants remain preserved.

| Artifact | Path | Dimensions | Size |
| --- | --- | --- | --- |
| Final grain web asset, WebP quality 92 | `public/images/after-dark-party-grain.webp` | 1254 × 1254 | 466,920 bytes |
| Original generated grain PNG | `output/art-reference/after-dark/after-dark-party-grain.png` | 1254 × 1254 | Original generated output |
| Grain edit target, preserved | `public/images/after-dark-party-orange.webp` | 1254 × 1254 | 144,072 bytes |

The encoded WebP was inspected at native size and in 600 × 600 and 345 × 345 display samples. Grain remains visible on the face, clothing and background at both display sizes. QA samples are in `output/art-reference/after-dark/after-dark-party-grain-qa-600.png` and `after-dark-party-grain-qa-345.png`.

### Grain editing prompt

```text
Use case: style-transfer.
Asset type: final square editorial nightlife photograph for The Pink House, 1254 x 1254 square.
Input image: the supplied orange party photograph is the exact edit target.
Primary request: add STRONG, visibly coarse and authentic 35mm high-ISO pushed-film grain to the entire photograph, with gritty direct-flash nightlife texture and slightly stronger noir black contrast. This is an analog texture edit only.
Grain requirements: organic irregular luminance grain with clusters roughly 3–5 pixels wide at the supplied 1254 x 1254 image size, varied in size and amplitude, not uniform digital 1-pixel noise. Grain must be plainly visible when this photograph is displayed at both 600 pixels and 345 pixels square. The skin, clothing, walls and shadow transition areas should all have real grain. Keep deep black areas black while making their transitions organically grainy. Highlights remain warm orange with subtle natural flash halation. Keep the photograph recognizable and preserve fine facial details underneath the grain.
Preserve invariants: EXACT orange and amber palette, dominant orange #ff641a, every face and facial identity, expression, closed eyes, Halloween makeup, hairstyle, clothing, posture, hand and fingers, jewelry, all party guests, environment, lighting direction, viewpoint, exact square crop, composition and object placement. The woman's upturned face and the raised upper-right hand stay precisely in their original positions.
Constraints: change only grain/analog surface texture and a slight increase in contrast. No purple, red, pink, magenta, changed palette, new objects or people, text, logos, watermark, artificial vignette, scratches, borders, frame, beauty retouching, smoothing or plastic skin. Do not replace or reconstruct the scene. It must feel like the same photo shot on coarse pushed high-ISO 35mm film.
```
