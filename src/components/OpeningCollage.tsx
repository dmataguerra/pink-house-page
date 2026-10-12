import { useEffect, useState } from 'react';
import './OpeningCollage.css';

const collageImages = [
  'after-dark-party-orange.webp',
  'archive-mask-cinematic.webp',
  'archive-party-cinematic.webp',
  'archive-location-documentary.webp',
  'after-dark-community-original.webp',
  'archive-house-cinematic.webp',
  'archive-prize-documentary.webp',
  'archive-drinks-documentary.webp',
  'archive-knife-cinematic.webp',
  'archive-01.png',
  'archive-02.png',
  'archive-03.png',
  'archive-location.webp',
  'archive-prize.webp',
  'instagram-profile-cinematic.webp',
];

export default function OpeningCollage() {
  const [visible, setVisible] = useState(true);
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    const firstImageDuration = 1000;
    const imageDuration = 120;
    const sequenceDuration = firstImageDuration + imageDuration * (collageImages.length - 1);
    const dismiss = () => setVisible(false);
    let imageTimer: number | undefined;
    const firstImageTimer = window.setTimeout(() => {
      setActiveImage(index => (index + 1) % collageImages.length);
      imageTimer = window.setInterval(() => setActiveImage(index => (index + 1) % collageImages.length), imageDuration);
    }, firstImageDuration);
    const timer = window.setTimeout(dismiss, sequenceDuration + 1250);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches) dismiss();
    window.addEventListener('scroll', dismiss, { passive: true, once: true });
    window.addEventListener('wheel', dismiss, { passive: true, once: true });
    window.addEventListener('touchmove', dismiss, { passive: true, once: true });
    window.addEventListener('keydown', dismiss, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(firstImageTimer);
      if (imageTimer !== undefined) window.clearInterval(imageTimer);
      window.removeEventListener('scroll', dismiss);
      window.removeEventListener('wheel', dismiss);
      window.removeEventListener('touchmove', dismiss);
      window.removeEventListener('keydown', dismiss);
    };
  }, []);

  if (!visible) return null;
  return <div className="opening-collage" role="status" aria-label="Cargando The Pink House">
    <div className="opening-collage-sequence" aria-hidden="true">
      {collageImages.map((image, index) => <div className={`opening-collage-tile opening-collage-tile-${index + 1}${index === activeImage ? ' is-active' : ''}`} key={image}>
        <img src={`${import.meta.env.BASE_URL}images/${image}`} alt="" />
      </div>)}
    </div>
    <div className="opening-collage-brand" aria-hidden="true">
      <img src={`${import.meta.env.BASE_URL}images/pink-house-after-dark-mark.svg`} alt="" />
    </div>
  </div>;
}
