import { useEffect, useRef, useState } from 'react';
import './AfterDarkLocation.css';

const source = `${import.meta.env.BASE_URL}videos/acercamiento-orbital.mp4?v=orbital-20261008`;
const poster = `${import.meta.env.BASE_URL}images/juriquilla-orbital-preview.webp`;
export default function AfterDarkLocation() {
  const section = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [nearby, setNearby] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [playbackIntent, setPlaybackIntent] = useState<'play' | 'pause' | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = section.current;
    if (!element) return;
    const loadingObserver = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setNearby(true);
      loadingObserver.disconnect();
    }, { rootMargin: '400px' });
    const playbackObserver = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting && entry.intersectionRatio >= .08);
    }, { threshold: [0, .08] });
    loadingObserver.observe(element);
    playbackObserver.observe(element);
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const onPreferenceChange = () => {
      setReducedMotion(preference.matches);
      if (preference.matches) setPlaybackIntent(intent => intent === 'play' ? null : intent);
    };
    const onVisibilityChange = () => setPageVisible(!document.hidden);
    preference.addEventListener('change', onPreferenceChange);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      loadingObserver.disconnect();
      playbackObserver.disconnect();
      preference.removeEventListener('change', onPreferenceChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const media = video.current;
    if (!media) return;
    const wantsPlayback = playbackIntent === 'play' || (playbackIntent === null && !reducedMotion);
    if (nearby && visible && pageVisible && wantsPlayback && !failed) {
      void media.play().catch(() => setPlaying(false));
    } else media.pause();
  }, [nearby, visible, pageVisible, reducedMotion, playbackIntent, failed]);

  const togglePlayback = () => {
    setNearby(true);
    setPlaybackIntent(playing ? 'pause' : 'play');
    if (playing) video.current?.pause();
    else if (nearby && visible && pageVisible) void video.current?.play().catch(() => setPlaying(false));
  };
  return <section ref={section} className={`ad-location${playing ? ' is-playing' : ''}`} id="location" aria-label="Recorrido de la locación">
    <div className="ad-location-view">
      <img className="ad-location-poster" src={poster} alt="" loading="lazy" width="640" height="360" aria-hidden="true" />
      <video ref={video} className="ad-map-video" src={nearby ? source : undefined} poster={nearby ? poster : undefined}
        muted playsInline loop preload={nearby ? 'metadata' : 'none'}
        aria-label="Recorrido 3D de Juriquilla con The Pink House, UAQ, UVM y ENES"
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => { setPlaying(false); setFailed(true); }} />
    </div>
    <div className="ad-location-shade" aria-hidden="true" />
    {!playing && !failed && <button type="button" className="ad-location-open" onClick={togglePlayback}>
      <span>REPRODUCIR MAPA</span><span aria-hidden="true">▷</span>
    </button>}
    <div className="ad-location-toolbar">
      {!failed && <button type="button" className="ad-location-playback" onClick={togglePlayback} aria-label={playing ? 'Pausar recorrido del mapa' : 'Reproducir recorrido del mapa'}>
        <span aria-hidden="true">{playing ? 'Ⅱ' : '▷'}</span><span>{playing ? 'PAUSAR' : 'REPRODUCIR'}</span>
      </button>}
    </div>
    {failed && <p className="ad-location-error" role="status">El recorrido no pudo cargarse. Intenta recargar la página.</p>}
  </section>;
}
