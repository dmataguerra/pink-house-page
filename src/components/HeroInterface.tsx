import { useEffect, useState } from 'react';
import Countdown from './Countdown';
import './HeroLanding.css';

export default function HeroInterface() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 32);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return <header className={`hero-interface${scrolled ? ' is-scrolled' : ''}`} aria-label="Halloween en Pink House">
    <div className="hero-header wrapper">
      <a href="#top" className="hero-header-logo" aria-label="Pink House — volver al inicio">
        <img src={`${import.meta.env.BASE_URL}images/pink-house-wordmark.svg`} alt="PINK HOUSE" width="860" height="260"/>
      </a>
      <nav className="hero-navigation" aria-label="Navegación principal">
        <a href="#archive">La casa</a>
        <a href="#rsvp">Tu entrada</a>
      </nav>
      <div className="hero-header-countdown"><Countdown/></div>
    </div>
  </header>;
}
