import { useEffect, useRef } from 'react';
export default function ScrollStory() {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      if (preference.matches) video.current?.pause();
      else void video.current?.play().catch(() => {});
    };
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);
  return <section className="cinematic-media" aria-label="Recorrido desde la órbita hasta The Pink House"><video ref={video} autoPlay muted loop playsInline preload="metadata"><source src={`${import.meta.env.BASE_URL}videos/pink-house.mp4?v=enes-trimmed-20261008`} type="video/mp4"/>Tu navegador no admite este video.</video></section>;
}

