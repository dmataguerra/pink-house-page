import { useEffect, useRef, useState } from 'react';
export default function ScrollStory() {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
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
  const toggle = () => {
    if (!video.current) return;
    if (video.current.paused) void video.current.play().catch(() => {});
    else video.current.pause();
  };
  return <section className="cinematic-media" id="la-casa" aria-label="Video de The Pink House">
    <video ref={video} autoPlay muted loop playsInline preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}><source src={`${import.meta.env.BASE_URL}videos/pink-house.mp4`} type="video/mp4"/>Tu navegador no admite este video.</video>
    <div className="film-overlay"><span>THE PINK HOUSE <small>DESPUÉS DE OSCURECER</small></span><button type="button" onClick={toggle} aria-label={playing ? 'Pausar video' : 'Reproducir video'}><span aria-hidden="true">{playing ? 'Ⅱ' : '▷'}</span>{playing ? 'Pausar' : 'Reproducir'}</button></div>
  </section>;
}
