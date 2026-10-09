import { useEffect, useState } from 'react';
import Countdown from './Countdown';
import './HeroLanding.css';

export default function HeroInterface() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 64);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return <div className={`hero-interface${scrolled ? ' is-scrolled' : ''}`}>
    <header className="hero-header" aria-label="Halloween en Pink House">
      <a href="#top" className="hero-header-logo" aria-label="Halloween — volver al inicio">
        <img src={`${import.meta.env.BASE_URL}images/halloween-wordmark.svg`} alt="HALLOWEEN" width="660" height="180"/>
      </a>
      <div className="hero-header-countdown"><Countdown/></div>
    </header>
    <div className="hero-viewfinder" aria-hidden="true">
      <i className="crop-mark crop-top-left"/><i className="crop-mark crop-top-right"/>
      <i className="crop-mark crop-bottom-left"/><i className="crop-mark crop-bottom-right"/>
      <i className="viewfinder-mid viewfinder-mid-left"/><i className="viewfinder-mid viewfinder-mid-right"/>
    </div>
  </div>;
}
