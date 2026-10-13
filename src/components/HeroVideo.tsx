import { useEffect, useRef } from 'react';
import './HeroVideo.css';

const source = `${import.meta.env.BASE_URL}videos/acercamiento-orbital.mp4?v=orbital-20261008`;
const poster = `${import.meta.env.BASE_URL}images/pink-house-video-preview.webp`;

export default function HeroVideo() {
  const preview = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const resume = () => {
      if (document.hidden) return;
      if (preview.current?.paused) void preview.current.play().catch(() => {});
    };
    resume();
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('pageshow', resume);
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('pageshow', resume);
    };
  }, []);

  return <div className="hero-video">
      <div className="hero-video-open">
        <video ref={preview} src={source} autoPlay muted playsInline loop preload="metadata" poster={poster} aria-hidden="true"/>
        <span className="hero-video-cue" aria-hidden="true">
          <svg className="hero-video-location" viewBox="0 0 20 20" width="18" height="18" fill="none"><path d="M16 8c0 4-6 9-6 9S4 12 4 8a6 6 0 1 1 12 0Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="10" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/></svg>
          <span className="hero-video-cue-label">Locación</span>
        </span>
      </div>
    </div>
  ;
}
