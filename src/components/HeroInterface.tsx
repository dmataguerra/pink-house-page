import { useEffect, useState } from 'react';
import Countdown from './Countdown';
import './HeroLanding.css';

export default function HeroInterface() {
  const [surface, setSurface] = useState({ scrolled: false, header: false, top: false, middle: false, bottom: false });

  useEffect(() => {
    const update = () => {
      const archive = document.getElementById('archive')?.getBoundingClientRect();
      const onPaper = (y: number) => !!archive && archive.top <= y && archive.bottom > y;
      const frame = document.querySelector('.hero-viewfinder')?.getBoundingClientRect();
      const logo = document.querySelector('.hero-header-logo')?.getBoundingClientRect();
      const headerCenter = logo ? logo.top + logo.height / 2 : 42;
      const next = { scrolled: window.scrollY > 64, header: onPaper(headerCenter), top: onPaper(frame?.top ?? 12), middle: onPaper(window.innerHeight / 2), bottom: onPaper(frame?.bottom ?? window.innerHeight - 12) };
      setSurface(previous => Object.keys(next).every(key => previous[key as keyof typeof next] === next[key as keyof typeof next]) ? previous : next);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, []);

  return <div className={`hero-interface${surface.scrolled ? ' is-scrolled' : ''}${surface.header ? ' is-header-on-paper' : ''}`}>
    <header className="hero-header" aria-label="Halloween en Pink House">
      <a href="#top" className="hero-header-logo" aria-label="Pink House — volver al inicio">
        <img src={`${import.meta.env.BASE_URL}images/pink-house-wordmark-gradient.svg`} alt="PINK HOUSE" width="860" height="260"/>
      </a>
      <div className="hero-header-countdown"><Countdown/></div>
    </header>
    <div className={`hero-viewfinder${surface.top ? ' is-top-on-paper' : ''}${surface.middle ? ' is-middle-on-paper' : ''}${surface.bottom ? ' is-bottom-on-paper' : ''}`} aria-hidden="true">
      <i className="crop-mark crop-top-left"/><i className="crop-mark crop-top-right"/>
      <i className="crop-mark crop-bottom-left"/><i className="crop-mark crop-bottom-right"/>
      <i className="viewfinder-mid viewfinder-mid-left"/><i className="viewfinder-mid viewfinder-mid-right"/>
    </div>
  </div>;
}
