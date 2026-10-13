export type GlobePresentationInput = {
  scrollY: number;
  scrollHeight: number;
  /** Stable viewport height (100svh) on mobile, window.innerHeight on desktop. */
  viewportHeight: number;
  mobile: boolean;
  /** Recovered desktop/mobile quality caps: 14, 6, 4, or 2.5 pixels. */
  maxBlur?: number;
  reducedMotion?: boolean;
};

export type GlobePresentation = {
  progress: number;
  y: number;
  scale: number;
  opacity: number;
  blur: number;
  rotationOffset: number;
  markersVisible: boolean;
  interactive: boolean;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** Recovered footer scroll choreography, independent of the rendering clock. */
export function calcGlobePresentation({ scrollY, scrollHeight, viewportHeight, mobile,
  maxBlur = mobile ? 4 : 14, reducedMotion = false }: GlobePresentationInput): GlobePresentation {
  const height = Math.max(1, viewportHeight || 1);
  const maxScroll = Math.max(1, scrollHeight - height);
  const reservedFooter = Math.min(height * .18, maxScroll * .2);
  const animationEnd = Math.max(1, maxScroll - reservedFooter);
  const currentScroll = Math.min(scrollY || 0, animationEnd);
  const revealWindow = height * 1.5;
  const progress = animationEnd <= revealWindow
    ? clamp01(currentScroll / animationEnd)
    : clamp01((currentScroll - (animationEnd - revealWindow)) / revealWindow);
  const blurProgress = mobile ? clamp01(progress / .9) : progress;
  return {
    progress,
    y: Math.round(height * (mobile ? .79 : 1) * (1 - progress)),
    scale: 2 + ((mobile ? 1.2 : 1) - 2) * progress,
    opacity: .55 + .45 * progress,
    blur: reducedMotion ? 0 : Math.min(14 * (1 - blurProgress), Math.max(0, maxBlur)),
    rotationOffset: progress * .8 * 360,
    markersVisible: progress >= .74,
    // Nike waits for the literal page bottom on mobile. Unlocking when the
    // globe has fully settled also permits input in the reserved footer area.
    interactive: !mobile || progress >= 1,
  };
}
