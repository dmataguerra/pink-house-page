import { useEffect, useRef, useState } from 'react';
import SiteModal from './SiteModal';
import './HeroVideo.css';

const source = `${import.meta.env.BASE_URL}videos/pink-house.mp4?v=enes-trimmed-20261008`;
const poster = `${import.meta.env.BASE_URL}images/pink-house-video-preview.webp`;

export default function HeroVideo() {
  const preview = useRef<HTMLVideoElement>(null);
  const expandedVideo = useRef<HTMLVideoElement>(null);
  const [open, setOpen] = useState(false);
  const [startTime, setStartTime] = useState(0);

  useEffect(() => {
    const resume = () => {
      if (document.hidden) return;
      [preview.current, expandedVideo.current].forEach(media => {
        if (media?.paused) void media.play().catch(() => {});
      });
    };
    resume();
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('pageshow', resume);
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('pageshow', resume);
    };
  }, []);

  const expand = () => {
    setStartTime(preview.current?.currentTime ?? 0);
    setOpen(true);
  };

  return <>
    <div className="hero-video">
      <button type="button" className="hero-video-open" onClick={expand}
        aria-label="Ver locación de Pink House" aria-haspopup="dialog" aria-controls="hero-video-modal">
        <video ref={preview} src={source} autoPlay muted playsInline loop preload="metadata" poster={poster} aria-hidden="true"/>
        <span className="hero-video-cue" aria-hidden="true">
          <svg className="hero-video-location" viewBox="0 0 20 20" width="18" height="18" fill="none"><path d="M16 8c0 4-6 9-6 9S4 12 4 8a6 6 0 1 1 12 0Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="10" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/></svg>
          <span className="hero-video-cue-label">Locación</span>
        </span>
      </button>
    </div>
    <SiteModal id="hero-video-modal" title="Locación de Pink House" open={open} onClose={() => setOpen(false)} className="hero-video-modal">
      {open && <video ref={expandedVideo} className="hero-video-full" src={source} poster={poster} autoPlay muted playsInline loop preload="metadata"
        controls disablePictureInPicture aria-label="Locación de Pink House" onLoadedMetadata={e => {
          e.currentTarget.currentTime = startTime;
          void e.currentTarget.play().catch(() => {});
        }}/>}
    </SiteModal>
  </>;
}
