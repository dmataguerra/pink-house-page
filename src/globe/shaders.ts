/**
 * Independently implemented from the recovered four-pass rendering mathematics.
 * Geography remains in the map pass. Input deforms the procedural sampling domain,
 * which feeds a persistent corona and the final difference/exclusion composite.
 * Canvas pointer coordinates are top-down; framebuffer coordinates are bottom-up.
 */
export const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const noiseVertexShader = /* glsl */ `
varying vec2 vTexCoord;
void main() {
  vTexCoord = vec2(uv.x, 1.0 - uv.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const noiseFragmentShader = /* glsl */ `
precision highp float;
varying vec2 vTexCoord;
uniform float noiseSeed;
uniform float noiseScale;
uniform float noiseSpeed;
uniform float noiseEvolveSpeed;
uniform float time;
uniform vec2 uResolution;
uniform vec2 u_mouse;
uniform float u_mouseSpeed;
uniform vec2 u_mouseDir;
uniform float uVelStrength;
uniform float uVelTrail;
uniform float uMouseEnabled;
uniform float uMouseStrength;
uniform float uMouseRadius;
uniform sampler2D uMouseTrailTex;
uniform float uPulseEnabled;
uniform vec2 uPulseCenter;
uniform float uPulseStrength;
uniform float uPulseRadius;
uniform float uPulseFrequency;

// The arithmetic ordering and seed are retained to preserve the recovered cells.
float seededHash(vec2 cell) {
  vec3 h = fract(vec3(cell.x, cell.y, cell.x) * 0.1031);
  h += dot(h, h.yzx + 33.33 + noiseSeed * 0.001);
  return fract((h.x + h.y) * h.z);
}
vec2 cellHash(vec2 cell) {
  return vec2(seededHash(cell), seededHash(cell + 19.19));
}
vec2 evolvingGradient(vec2 cell, float evolution) {
  float angle = 6.283185 * seededHash(cell) + evolution;
  return vec2(cos(angle), sin(angle));
}
float gradientField(vec2 positionInCells, float evolution) {
  vec2 origin = floor(positionInCells);
  vec2 local = positionInCells - origin;
  vec2 eased = local * local * (3.0 - 2.0 * local);
  float bottomLeft = dot(evolvingGradient(origin, evolution), local);
  float bottomRight = dot(evolvingGradient(origin + vec2(1.0, 0.0), evolution), local - vec2(1.0, 0.0));
  float topLeft = dot(evolvingGradient(origin + vec2(0.0, 1.0), evolution), local - vec2(0.0, 1.0));
  float topRight = dot(evolvingGradient(origin + vec2(1.0, 1.0), evolution), local - vec2(1.0, 1.0));
  return mix(mix(bottomLeft, bottomRight, eased.x), mix(topLeft, topRight, eased.x), eased.y) / 0.7;
}
float evolvingF1(vec2 positionInCells, float evolution) {
  vec2 origin = floor(positionInCells);
  float nearest = 1.0e9;
  for (int x = -1; x <= 1; ++x) {
    for (int y = -1; y <= 1; ++y) {
      vec2 cell = origin + vec2(float(x), float(y));
      vec2 phase = 6.283185 * cellHash(cell + vec2(11.7, 27.3));
      vec2 motion = vec2(sin(evolution + phase.x), cos(evolution * 1.37 + phase.y));
      vec2 point = 0.5 + (cellHash(cell) - 0.5) * 0.85 + 0.22 * motion;
      nearest = min(nearest, length(cell + point - positionInCells));
    }
  }
  return nearest;
}
float trailAt(vec2 uv) {
  // Deliberately 512-based, including on lower tiers, as in the recovered effect.
  vec2 stepUV = vec2(2.0 / 512.0);
  float painted = 0.16 * texture2D(uMouseTrailTex, uv).r;
  painted += 0.12 * texture2D(uMouseTrailTex, uv + vec2(stepUV.x, 0.0)).r;
  painted += 0.12 * texture2D(uMouseTrailTex, uv - vec2(stepUV.x, 0.0)).r;
  painted += 0.12 * texture2D(uMouseTrailTex, uv + vec2(0.0, stepUV.y)).r;
  painted += 0.12 * texture2D(uMouseTrailTex, uv - vec2(0.0, stepUV.y)).r;
  painted += 0.09 * texture2D(uMouseTrailTex, uv + stepUV).r;
  painted += 0.09 * texture2D(uMouseTrailTex, uv + vec2(-stepUV.x, stepUV.y)).r;
  painted += 0.09 * texture2D(uMouseTrailTex, uv + vec2(stepUV.x, -stepUV.y)).r;
  painted += 0.09 * texture2D(uMouseTrailTex, uv - stepUV).r;
  return pow(clamp(painted, 0.0, 1.0), 1.2);
}
vec2 warpedDomain(vec2 fixedUV, vec2 animatedUV) {
  if (u_mouse.x < 0.0 || u_mouse.x > 1.0 || u_mouse.y < 0.0 || u_mouse.y > 1.0) {
    return animatedUV;
  }
  vec2 offset = fixedUV - u_mouse;
  float speed = clamp(u_mouseSpeed, 0.0, 1.0);
  float movement = smoothstep(0.01, 0.18, speed);
  float amplitude = mix(0.22, 1.0, movement) * step(0.5, uMouseEnabled);
  float epsilonUV = 1.25 / min(uResolution.x, uResolution.y);
  float evolution = time * noiseEvolveSpeed;
  float centerField = gradientField(fixedUV * noiseScale, evolution);
  vec2 gradient = vec2(
    gradientField((fixedUV + vec2(epsilonUV, 0.0)) * noiseScale, evolution) - centerField,
    gradientField((fixedUV + vec2(0.0, epsilonUV)) * noiseScale, evolution) - centerField
  );
  float gradientLength = length(gradient);
  vec2 normal = gradientLength > 1.0e-6 ? gradient / gradientLength : vec2(1.0, 0.0);
  vec2 tangent = vec2(-normal.y, normal.x);
  vec2 ellipticalOffset = vec2(dot(offset, normal), dot(offset, tangent));
  ellipticalOffset.x *= 1.35;
  float distanceFromPointer = length(ellipticalOffset);
  // GLSL defines smoothstep only with ascending edges. This is the portable form
  // of the recovered reverse-edge falloff, retaining its shape and constants.
  float influence = (1.0 - smoothstep(0.0, uMouseRadius, distanceFromPointer)) * uMouseStrength * amplitude;
  vec2 radialDirection = offset / (length(offset) + 1.0e-4);
  float oscillation = sin(time * 1.15 + distanceFromPointer * 12.5);
  vec2 radial = radialDirection * (0.050 * influence * oscillation);
  radial *= smoothstep(0.0, uMouseRadius * 0.65, distanceFromPointer);

  float directionLength = length(u_mouseDir);
  vec2 flowDirection = directionLength > 1.0e-6 ? u_mouseDir / directionLength : vec2(1.0, 0.0);
  vec2 flowTangent = vec2(-flowDirection.y, flowDirection.x);
  float middleBand = influence * (1.0 - influence);
  float smearGate = pow(movement, 1.6);
  float trailLength = mix(1.0, 3.0, clamp(uVelTrail, 0.0, 1.0));
  float smearAmount = (0.20 * middleBand) * speed * uVelStrength * smearGate * trailLength;
  vec2 smear = -flowDirection * smearAmount;
  vec2 padding = flowTangent * (0.02 * middleBand * speed * uVelStrength * uVelTrail) * smearGate;
  float trailMask = trailAt(vec2(fixedUV.x, 1.0 - fixedUV.y));
  vec2 persistence = -flowDirection * (0.22 * trailMask * uVelStrength * uVelTrail);
  return animatedUV + radial + smear + padding + persistence;
}
float markerPulse(vec2 fixedUV) {
  if (uPulseEnabled <= 0.5 || uPulseCenter.x < 0.0 || uPulseCenter.x > 1.0 ||
      uPulseCenter.y < 0.0 || uPulseCenter.y > 1.0) return 0.0;
  float distanceFromMarker = distance(fixedUV, uPulseCenter);
  float wave = 0.5 + 0.5 * sin(time * uPulseFrequency * 6.283185);
  float radius = uPulseRadius * mix(0.85, 1.15, wave);
  float thickness = max(0.002, radius * 0.25);
  float ring = 1.0 - smoothstep(0.0, thickness, abs(distanceFromMarker - radius));
  float center = (1.0 - smoothstep(0.0, radius, distanceFromMarker)) * 0.35;
  return (ring * 0.8 + center * 0.2) * uPulseStrength;
}
void main() {
  vec2 animatedUV = vTexCoord + vec2(time * noiseSpeed);
  vec2 domain = warpedDomain(vTexCoord, animatedUV) * noiseScale;
  float evolution = time * noiseEvolveSpeed;
  // Fixed active branch: evolving Worley F1, with independent RGB cell offsets.
  vec3 noise = vec3(
    evolvingF1(domain, evolution),
    evolvingF1(domain + vec2(5.2, 1.3), evolution),
    evolvingF1(domain + vec2(9.7, 4.4), evolution)
  );
  gl_FragColor = vec4(clamp(noise + markerPulse(vTexCoord), 0.0, 1.0), 1.0);
}
`;

export const coronaFragmentShader = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D iBuffer;
uniform sampler2D iNoise;
uniform sampler2D iGlobeSphere;
uniform vec2 uResolution;
uniform float uFrameCount;
uniform float uDisplaceFactor;
uniform float uMixFactor;
uniform float uScaleFactor;
uniform float uExpandFactor;
uniform float uUvScale;

void main() {
  vec2 noiseUV = (vUv - 0.5) / max(0.0001, uUvScale) + 0.5;
  vec2 flow = texture2D(iNoise, noiseUV).xy * 2.0 - 1.0;
  vec2 contracted = (vUv - 0.5) * ((100.0 - uScaleFactor) / 100.0) + 0.5;
  vec2 advectedPx = contracted * uResolution + flow * uDisplaceFactor * uResolution;
  vec2 advected = advectedPx / uResolution;
  vec4 dilation = vec4(0.0);
  float brightest = 0.0;
  for (int y = -1; y <= 1; ++y) {
    for (int x = -1; x <= 1; ++x) {
      vec2 neighborhood = vec2(float(x), float(y)) * (uExpandFactor / uResolution);
      vec4 candidate = texture2D(iBuffer, fract(advected + neighborhood));
      float intensity = dot(candidate.rgb, vec3(0.299, 0.587, 0.114));
      if (intensity > brightest) {
        brightest = intensity;
        dilation = candidate;
      }
    }
  }
  vec4 disc = texture2D(iGlobeSphere, vUv);
  gl_FragColor = uFrameCount <= 4.0 ? disc : mix(dilation, disc, uMixFactor);
}
`;

export const blendFragmentShader = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform float uUvScale;
uniform sampler2D tDiffuse;
uniform sampler2D tDisplacementTexture;
uniform sampler2D tGlobeSphere;
uniform sampler2D tGlobeSphereSharp;
uniform sampler2D tNoise;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uBackgroundColor;
uniform float levelsBlack;
uniform float levelsWhite;
uniform float gamma;
uniform float mapStrength;
uniform float sphereInvert;
uniform float sphereAdd;
uniform float mapBlur;
uniform float innerNoiseAmount;
uniform float innerNoiseBlur;
uniform float innerNoiseBlack;
uniform float innerNoiseWhite;
uniform float innerNoiseGamma;
uniform int uDebugView;

float globeLuminance(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}
vec3 levels(vec3 color, float black, float white, float exponent) {
  float range = max(white, black + 1.0e-4) - black;
  return pow(clamp((color - black) / range, 0.0, 1.0), vec3(1.0 / max(exponent, 1.0e-4)));
}
float neighborhoodLuma(sampler2D source, vec2 center, float radius) {
  vec2 interval = radius / max(uResolution, vec2(1.0));
  float total = 0.0;
  for (int y = -1; y <= 1; ++y) {
    for (int x = -1; x <= 1; ++x) {
      total += globeLuminance(texture2D(source, center + vec2(float(x), float(y)) * interval).rgb);
    }
  }
  return total / 9.0;
}
void main() {
  vec2 globeUV = (vUv - 0.5) * uUvScale + 0.5;
  if (uDebugView == 1) { gl_FragColor = texture2D(tNoise, vUv); return; }
  if (uDebugView == 2) { gl_FragColor = texture2D(tDiffuse, globeUV); return; }
  if (uDebugView == 3) { gl_FragColor = texture2D(tDisplacementTexture, globeUV); return; }
  if (uDebugView == 4) { gl_FragColor = texture2D(tGlobeSphere, globeUV); return; }
  if (uDebugView == 5) { gl_FragColor = texture2D(tGlobeSphereSharp, globeUV); return; }
  vec3 corona = texture2D(tDisplacementTexture, globeUV).rgb;
  vec3 softDisc = texture2D(tGlobeSphere, globeUV).rgb;
  vec3 sharpDisc = texture2D(tGlobeSphereSharp, globeUV).rgb;
  float geography = mapBlur > 0.5
    ? neighborhoodLuma(tDiffuse, globeUV, mapBlur)
    : globeLuminance(texture2D(tDiffuse, globeUV).rgb);
  vec3 firstDifference = abs(corona - mapStrength * vec3(geography));
  vec3 secondDifference = abs(firstDifference - (1.0 - sphereInvert * sharpDisc));
  vec3 discContribution = clamp(sphereAdd * softDisc, 0.0, 1.0);
  vec3 exclusion = secondDifference + discContribution - 2.0 * secondDifference * discContribution;
  float coronaLuma = globeLuminance(corona);
  float interior = smoothstep(0.20, 0.95, coronaLuma);
  float noiseLuma = innerNoiseBlur > 0.5
    ? neighborhoodLuma(tNoise, vUv, innerNoiseBlur)
    : globeLuminance(texture2D(tNoise, vUv).rgb);
  float processedNoise = levels(vec3(noiseLuma), innerNoiseBlack, innerNoiseWhite, innerNoiseGamma).r;
  vec3 injection = exclusion + (processedNoise - 0.5) * (innerNoiseAmount * interior);
  float intensity = globeLuminance(levels(injection, levelsBlack, levelsWhite, gamma));
  vec3 tint = mix(uColor1, uColor2, intensity);
  gl_FragColor = vec4(mix(uBackgroundColor, tint, coronaLuma), 1.0);
}
`;
