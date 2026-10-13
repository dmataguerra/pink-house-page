/** The recovered device-hint profiles; sizes are actual allocations, not just uniforms. */
export type GlobeQuality = {
  name: 'desktop' | 'mobile-high' | 'mobile-medium' | 'mobile-low' | 'reduced-motion';
  resolution: 512 | 384 | 320 | 256;
  pixelRatio: number;
  trailAmount: number;
  mobile: boolean;
  reducedMotion: boolean;
};

export function selectGlobeQuality(reducedMotion: boolean, viewportWidth = window.innerWidth): GlobeQuality {
  const mobile = viewportWidth <= 767;
  const dpr = window.devicePixelRatio || 1;
  if (reducedMotion) return { name: 'reduced-motion', resolution: 256, pixelRatio: 1, trailAmount: 0, mobile, reducedMotion };
  // A desktop cap avoids multiplying the final pass cost on very dense displays.
  if (!mobile) return { name: 'desktop', resolution: 512, pixelRatio: Math.min(dpr, 2), trailAmount: .7, mobile, reducedMotion };
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 0;
  let score = cores >= 8 ? 2 : cores >= 6 ? 1 : cores <= 4 ? -1 : 0;
  score += memory >= 6 ? 2 : memory >= 4 ? 1 : memory > 0 && memory <= 2 ? -2 : 0;
  if (dpr >= 3) score -= 1;
  if (viewportWidth >= 430) score += 1;
  if (score >= 2) return { name: 'mobile-high', resolution: 512, pixelRatio: Math.min(dpr, 1.5), trailAmount: .7, mobile, reducedMotion };
  if (score >= 0) return { name: 'mobile-medium', resolution: 384, pixelRatio: Math.min(dpr, 1.2), trailAmount: .45, mobile, reducedMotion };
  return { name: 'mobile-low', resolution: 320, pixelRatio: Math.min(dpr, 1), trailAmount: .2, mobile, reducedMotion };
}
