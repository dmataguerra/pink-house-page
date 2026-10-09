import { useEffect, useState } from 'react';
import HeroVideo from './HeroVideo';
import Countdown from './Countdown';
import { event } from '../config/event';
import './HeroLanding.css';
export default function HeroLanding({ onConfirm }: { onConfirm: () => void }) {
 const [slide,setSlide] = useState(0);
 useEffect(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const timer = window.setInterval(() => setSlide(s => (s+1)%2),6000);
  return () => window.clearInterval(timer);
 },[]);
 return <section className="hero" id="top" aria-labelledby="hero-wordmark">
  <svg className="hero-layer-filter" aria-hidden="true" width="0" height="0"><defs><filter id="hero-foreground-opacity" colorInterpolationFilters="sRGB"><feComponentTransfer><feFuncA type="linear" slope="1.04" intercept="-0.02"/></feComponentTransfer></filter></defs></svg>
  <img className="hero-art hero-backdrop" src={`${import.meta.env.BASE_URL}images/halloween-portrait-scene.webp`} alt="" width="1440" height="1280" fetchPriority="high"/>
  <p className="hero-event-metadata"><strong>Halloween 2026</strong><br/>22 de octubre · Desde las 20:00</p>
  <div className="hero-header-countdown"><span className="hero-countdown-label">Nos vemos en</span><Countdown/></div>
  <div className="hero-content">
   <div className="hero-fullscreen">
    <div className="hero-composition">
     <h1 id="hero-wordmark" className="sr-only">PINK HOUSE — Halloween 2026</h1>
     <div className="hero-word hero-pink" aria-hidden="true">PINK</div>
     <div className="hero-description">
      <p className="hero-intro">Estudiantes que hacen pedas caseras. Este año quisimos subir el nivel. Ven a descubrirlo.</p>
      <div className="hero-details">
       <p className="hero-details-label">Halloween en la casa:</p>
       <p><time dateTime={`${event.eventDate}T${event.eventTime}:00${event.utcOffset}`}>22 de octubre de 2026 · 20:00</time><br/>Disfraz recomendado, no obligatorio.<br/>Concurso y premio al mejor disfraz.<br/>Ubicación al confirmar.</p>
       <button className="hero-confirm" type="button" onClick={onConfirm} aria-label="Confirmar asistencia" aria-haspopup="dialog" aria-controls="attendance-modal">Confirmar asistencia <span aria-hidden="true">↗</span></button>
      </div>
     </div>
     <div className="hero-word hero-date" aria-hidden="true">22</div>
     <div className="hero-word hero-house" aria-hidden="true">HOUSE</div>
    </div>
    <p className="hero-tagline">La casa de siempre.<br/>Una noche diferente.<br/>The Pink House.</p>
    <img className="hero-art hero-character" src={`${import.meta.env.BASE_URL}images/halloween-portrait-cutout.webp`} alt="Invitado con máscara de Halloween y overol de trabajo bajo una luz roja cinematográfica" width="1440" height="1280" fetchPriority="high"/>
    <div className="hero-media"><HeroVideo/></div>
   </div>
   <div className="hero-slider">
    <span className="hero-slide-pagination" aria-hidden="true">{slide+1} / 2</span>
    <p className="hero-slide-copy" key={slide}>{slide===0 ? 'Lo que pasa en la Pink House se queda en la Pink House.' : 'Recomendado venir con disfraz. Habrá premio al mejor de la noche.'}</p>
    <button className="hero-slide-action" type="button" onClick={onConfirm} aria-haspopup="dialog" aria-controls="attendance-modal">¿Nos vemos? <span aria-hidden="true">↗</span></button>
   </div>
  </div>
 </section>;
}

