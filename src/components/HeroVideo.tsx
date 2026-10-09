import { useEffect, useRef, useState } from 'react';
import SiteModal from './SiteModal';

const source = `${import.meta.env.BASE_URL}videos/pink-house.mp4?v=enes-trimmed-20261008`;
const poster = `${import.meta.env.BASE_URL}images/pink-house-video-preview.webp`;

export default function HeroVideo() {
  const preview = useRef<HTMLVideoElement>(null);
  const widget = useRef<HTMLDivElement>(null);
  const manuallyPaused = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(false);
  const [startTime, setStartTime] = useState(0);

  useEffect(() => {
    const media = preview.current;
    if (!media) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    const update = () => {
      if (!visible || open || document.hidden || preference.matches || manuallyPaused.current) media.pause();
      else {
        if (!media.getAttribute('src')) media.src = source;
        void media.play().catch(() => {});
      }
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); }, { threshold: .25 });
    if (widget.current) observer.observe(widget.current);
    preference.addEventListener('change', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      observer.disconnect(); preference.removeEventListener('change', update);
      document.removeEventListener('visibilitychange', update); media.pause();
    };
  }, [open]);

  const togglePreview = () => {
    const media = preview.current;
    if (!media) return;
    manuallyPaused.current = !media.paused;
    if (!media.paused) media.pause();
    else {
      if (!media.getAttribute('src') || media.error) media.src = source;
      void media.play().catch(() => {});
    }
  };
  const expand = () => {
    setStartTime(preview.current?.currentTime ?? 0);
    preview.current?.pause(); setOpen(true);
  };

  return <>
    <div ref={widget} className="hero-video">
      <button type="button" className="hero-video-open" onClick={expand}
        aria-label="Abrir video de Pink House" aria-haspopup="dialog" aria-controls="hero-video-modal">
        <video ref={preview} muted playsInline loop preload="none" poster={poster}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} aria-hidden="true"/>
        <span className="hero-video-expand" aria-hidden="true"><svg viewBox="0 0 20 20" width="16" height="16" fill="none"><path d="M3 8V3h5m4 0h5v5m0 4v5h-5M8 17H3v-5" stroke="currentColor" strokeWidth="1.3"/></svg></span>
      </button>
      <button type="button" className="hero-video-toggle" onClick={togglePreview}
        aria-label={playing ? 'Pausar vista previa' : 'Reproducir vista previa'} aria-pressed={playing}>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
          {playing ? <path d="M4 3h3v10H4zm5 0h3v10H9z"/> : <path d="m4 2 10 6-10 6z"/>}
        </svg>
      </button>
    </div>
    <SiteModal id="hero-video-modal" title="PINK HOUSE" open={open} onClose={() => setOpen(false)} className="hero-video-modal">
      {open && <video className="hero-video-full" src={source} poster={poster} controls autoPlay muted playsInline preload="metadata"
        aria-label="Recorrido a Pink House" onLoadedMetadata={e => {
          e.currentTarget.currentTime = startTime;
          void e.currentTarget.play().catch(() => {});
        }}/>}
    </SiteModal>
  </>;
}
