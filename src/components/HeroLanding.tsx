import HeroVideo from './HeroVideo';
import { event } from '../config/event';
import './HeroLanding.css';

export default function HeroLanding({ onConfirm }: { onConfirm: () => void }) {
  return <section className="hero" id="top" aria-labelledby="hero-wordmark">
    <div className="hero-center">
      <p className="section-eyebrow">Una noche en The Pink House</p>
      <h1 className="hero-wordmark" id="hero-wordmark">
        <img src={`${import.meta.env.BASE_URL}images/halloween-wordmark.svg`} alt="HALLOWEEN" width="660" height="180" fetchPriority="high"/>
      </h1>
      <p className="hero-tagline">La casa de siempre. Una noche diferente.</p>
    </div>
    <div className="hero-bottom wrapper">
      <div className="hero-event">
        <p className="hero-event-date"><time dateTime={event.eventDate}>22 de octubre de 2026</time></p>
        <p className="hero-event-description">Disfraz recomendado, no obligatorio.</p>
        <button type="button" className="button" onClick={onConfirm} aria-haspopup="dialog" aria-controls="attendance-modal"><span className="button-label">Confirmar asistencia</span><span aria-hidden="true">↗</span></button>
      </div>
      <div className="hero-media"><HeroVideo/></div>
    </div>
  </section>;
}
