import { useEffect, useState } from 'react';
import './OpeningCollage.css';

const collageImages = [
  'after-dark-party-orange.webp',
  'after-dark-community-original.webp',
  'archive-party-cinematic.webp',
];
const sessionKey = 'pink-house-opening-seen-v2';

function shouldShowOpening() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  try { return sessionStorage.getItem(sessionKey) !== '1'; } catch { return true; }
}

export default function OpeningCollage() {
  const [visible, setVisible] = useState(shouldShowOpening);
  const [activeImage, setActiveImage] = useState(0);
  const [preparedImages, setPreparedImages] = useState(1);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    try { sessionStorage.setItem(sessionKey, '1'); } catch { /* The opening also works without session storage. */ }
    const dismiss = () => setVisible(false);
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    if (preference.matches) { dismiss(); return; }
    const onPreferenceChange = () => { if (preference.matches) dismiss(); };
    const timers = [
      window.setTimeout(() => setPreparedImages(2), 180),
      window.setTimeout(() => { setActiveImage(1); setPreparedImages(3); }, 650),
      window.setTimeout(() => setActiveImage(2), 1050),
      window.setTimeout(() => setLeaving(true), 1350),
      window.setTimeout(dismiss, 1800),
    ];
    preference.addEventListener('change', onPreferenceChange);
    window.addEventListener('scroll', dismiss, { passive: true, once: true });
    window.addEventListener('wheel', dismiss, { passive: true, once: true });
    window.addEventListener('touchmove', dismiss, { passive: true, once: true });
    window.addEventListener('pointerdown', dismiss, { passive: true, once: true });
    window.addEventListener('keydown', dismiss, { once: true });
    return () => {
      timers.forEach(window.clearTimeout);
      preference.removeEventListener('change', onPreferenceChange);
      window.removeEventListener('scroll', dismiss);
      window.removeEventListener('wheel', dismiss);
      window.removeEventListener('touchmove', dismiss);
      window.removeEventListener('pointerdown', dismiss);
      window.removeEventListener('keydown', dismiss);
    };
  }, [visible]);

  if (!visible) return null;
  return <div className={`opening-collage${leaving ? ' is-leaving' : ''}`} aria-hidden="true">
    <div className="opening-collage-sequence">
      {collageImages.slice(0, preparedImages).map((image, index) => <div className={`opening-collage-tile opening-collage-tile-${index + 1}${index === activeImage ? ' is-active' : ''}`} key={image}>
        <img src={`${import.meta.env.BASE_URL}images/${image}`} alt="" width="1254" height="1254" loading={index === 0 ? 'eager' : 'lazy'} fetchPriority={index === 0 ? 'high' : 'low'} />
      </div>)}
    </div>
    <div className="opening-collage-brand">
      <img src={`${import.meta.env.BASE_URL}images/pink-house-after-dark-mark.svg`} alt="" />
    </div>
  </div>;
}
