# The Pink House: violet and pink party photograph

The violet and magenta party photograph is a lighting edit of the existing original The Pink House scene, created with the built-in `image_gen` tool. The edit replaces the red illumination while preserving the people, Halloween makeup, poses, square composition, deep shadows, and photographic grain. It was visually inspected before saving.

| Artifact | Path | Dimensions | Size |
| --- | --- | --- | --- |
| Web asset, WebP quality 88 | `public/images/after-dark-party-purple.webp` | 1254 × 1254 | 115,206 bytes |
| Edited PNG archive | `output/art-reference/after-dark/after-dark-party-purple.png` | 1254 × 1254 | Original generated output |
| Edit target, preserved | `public/images/after-dark-party-original.webp` | 1254 × 1254 | 111,266 bytes |

The black-and-white community photograph remains unchanged. The original generated PNG and the previous red WebP are preserved. The editing prompt used violet `#c749ff` and magenta illumination. The final interface palette was subsequently softened to `#b593c7`; the source image remains available for a more restrained display saturation without regenerating the scene.

## Final editing prompt

```text
Use case: lighting-weather.
Asset type: square editorial Halloween photograph for The Pink House website.
Input image: the attached local photograph is the exact edit target.
Primary request: change ONLY the colored party lighting from monochromatic red to rich violet and magenta, using violet #c749ff as the dominant hue with restrained pink highlights.
Preserve invariants: keep every person and face, face identity, facial expression, closed eyes, Halloween makeup, hairstyle, clothing, posture, hand, fingers, jewelry, party guests, environment, camera viewpoint, framing, composition, crop, lighting direction, exposure, original deep blacks, shadow placement, grain and natural photograph texture exactly as in the edit target. The woman's face remains in the same central tilted-up position and the raised hand remains at the upper-right edge.
Color palette: violet, purple and magenta party light against deep black shadows. Replace all red, red-orange and amber illumination with violet/magenta illumination. There must be no reddish cast.
Constraints: no new people or objects, no removal, no text, no logos, no watermarks, no beautification, no plastic skin, no changed anatomy, no changed scene, no camera or crop change. This is a color-lighting edit only.
```
