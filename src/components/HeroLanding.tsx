import HeroVideo from './HeroVideo';
import './HeroLanding.css';

export default function HeroLanding({ onConfirm }: { onConfirm: () => void }) {
  return <section className="hero hero-redesign" id="top" aria-labelledby="hero-wordmark">
    <h1 className="hero-wordmark" id="hero-wordmark">
      <img src={`${import.meta.env.BASE_URL}images/pink-house-wordmark.svg`} alt="PINK HOUSE" width="860" height="260"/>
      <span className="hero-wordmark-frame" aria-hidden="true">
        <i className="crop-mark crop-top-left"/><i className="crop-mark crop-top-right"/>
        <i className="crop-mark crop-bottom-left"/><i className="crop-mark crop-bottom-right"/>
      </span>
    </h1>
    <div className="hero-bottom">
      <button type="button" className="hero-event" onClick={onConfirm} aria-haspopup="dialog" aria-controls="attendance-modal">
        <span className="hero-micro-label"><span aria-hidden="true"/>FIESTA DE DISFRACES</span>
        <span className="hero-event-description">Disfraz recomendado, no obligatorio.</span>
        <span className="hero-event-date">22 DE OCTUBRE DE 2026</span>
        <span className="hero-event-confirm">CONFIRMAR <span aria-hidden="true">→</span></span>
      </button>
      <HeroVideo/>
    </div>
  </section>;
}
