import { useEffect, useRef, useState } from 'react';

// Keep the URL identical to the cinematic section so the browser can reuse its cache.
const source = `${import.meta.env.BASE_URL}videos/pink-house.mp4?v=enes-trimmed-20261008`;

export default function HeroVideo() {
  const video = useRef<HTMLVideoElement>(null);
  const widget = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) video.current?.pause();
    });
    if (widget.current) observer.observe(widget.current);
    const pauseWhenHidden = () => { if (document.hidden) video.current?.pause(); };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', pauseWhenHidden);
    };
  }, []);

  const toggle = async () => {
    const media = video.current;
    if (!media) return;
    if (!media.paused) { media.pause(); return; }
    setError(false);
    setLoading(true);
    try {
      // No preview video request until the visitor explicitly chooses playback.
      if (!media.getAttribute('src')) media.src = source;
      await media.play();
    } catch { setError(true); }
    finally { setLoading(false); }
  };

  return <div ref={widget} className={`hero-video${playing ? ' is-playing' : ''}`}>
    <div className="hero-video-preview">
      <video ref={video} id="hero-preview-video" muted playsInline loop preload="none"
        poster={`${import.meta.env.BASE_URL}images/pink-house-video-preview.webp`}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onError={() => { setError(true); setLoading(false); }} aria-label="Vista previa del recorrido a Pink House"/>
    </div>
    <div className="hero-video-meta">
      <span className="hero-micro-label"><span aria-hidden="true"/>PINK HOUSE</span>
      <span className="hero-video-title">DESDE LA ÓRBITA<br/>HASTA LA FIESTA</span>
      <button type="button" onClick={() => void toggle()} className="hero-video-toggle" disabled={loading}
        aria-label={playing ? 'Pausar video de Pink House' : 'Reproducir video de Pink House'}
        aria-controls="hero-preview-video" aria-pressed={playing}>
        <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
          {playing ? <path d="M4 3h3v10H4zm5 0h3v10H9z"/> : <path d="m4 2 10 6-10 6z"/>}
        </svg>
        {loading ? 'CARGANDO' : playing ? 'PAUSAR' : 'REPRODUCIR'}
      </button>
      {error && <span className="hero-video-error" role="status">No se pudo reproducir. Intenta de nuevo.</span>}
    </div>
  </div>;
}
