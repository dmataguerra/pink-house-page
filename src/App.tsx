import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ScrollStory from './sections/ScrollStory';
import Countdown from './components/Countdown';
import HalloweenButton from './components/HalloweenButton';
import { event } from './config/event';
import { parties } from './data/parties';
import './styles/nightfall.css';

gsap.registerPlugin(ScrollTrigger);
const identity = `${import.meta.env.BASE_URL}images/identity/`;
const calendarUrl = 'https://calendar.app.google/HCNWJHqhFCBNuWdn9';

export default function App() {
  const root = useRef<HTMLDivElement>(null);
  const [showFloatingCountdown, setShowFloatingCountdown] = useState(false);
  const instagram = `https://www.instagram.com/${event.instagramUsername}/`;

  useLayoutEffect(() => {
    const context = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add({ motion: '(prefers-reduced-motion: no-preference)', desktop: '(min-width: 701px)' }, scope => {
        if (!scope.conditions?.motion) return;
        const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
        intro.from('.hero-kicker', { y: 16, opacity: 0, duration: .7 })
          .from('.headline-line > span', { yPercent: 108, duration: 1.15, stagger: .12 }, .1)
          .from('.hero-side, .hero-meta, .hero-scroll', { y: 24, opacity: 0, duration: .85, stagger: .1 }, .5)
          .from('.hero-seal', { scale: .9, opacity: 0, duration: 1 }, .55);
        gsap.to('.hero-halo', { y: 70, opacity: .35, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1.3 } });
        gsap.to('.hero-seal', { rotation: 24, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1.5 } });
        gsap.from('.cinematic-media video', { scale: 1.07, ease: 'none', scrollTrigger: { trigger: '.cinematic-media', start: 'top bottom', end: 'bottom top', scrub: 1.2 } });
        const cards = gsap.utils.toArray<HTMLElement>('.archive-card');
        if (scope.conditions.desktop) {
          gsap.from(cards, { y: 55, opacity: 0, duration: 1, stagger: .16, ease: 'power3.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: '.archive-gallery', start: 'top 88%', once: true } });
        } else {
          cards.forEach(card => gsap.from(card, { y: 35, opacity: 0, duration: .85, clearProps: 'transform,opacity', scrollTrigger: { trigger: card, start: 'top 92%', once: true } }));
        }
        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach(element => gsap.from(element, { y: 32, opacity: 0, duration: .9, ease: 'power3.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: element, start: 'top 92%', once: true } }));
      });
      return () => mm.revert();
    }, root);
    return () => context.revert();
  }, []);

  useEffect(() => {
    const update = () => {
      const hero = root.current?.querySelector('.hero');
      setShowFloatingCountdown(!!hero && hero.getBoundingClientRect().bottom <= 0);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, []);

  return <div ref={root} className={`nightfall${showFloatingCountdown ? ' has-floating-countdown' : ''}`}>
    <header className="site-nav wrapper" id="top">
      <a href="#top" className="brand"><img src={`${import.meta.env.BASE_URL}images/pink-house-logo.png`} alt="THE PINK HOUSE"/></a>
      <div className="nav-right"><span>22.10.26</span><HalloweenButton compact href={instagram}>Confirmar</HalloweenButton></div>
    </header>
    {showFloatingCountdown && <div className="floating-countdown"><Countdown/></div>}
    <main>
      <section className="hero wrapper">
        <div className="hero-halo" aria-hidden="true"/>
        <div className="hero-title">
          <p className="hero-kicker"><span/> UNA CASA. OTRA DIMENSIÓN.</p>
          <h1 aria-label="Halloween en The Pink House"><span className="headline-line"><span>HALLOWEEN</span></span><span className="headline-line headline-bridge"><span>EN THE</span></span><span className="headline-line headline-pink"><span>PINK HOUSE</span></span></h1>
          <div className="hero-meta"><span className="date-number">22</span><div><strong>OCTUBRE / 2026</strong><span>Una sola noche.</span></div></div>
        </div>
        <div className="hero-side">
          <div className="hero-countdown"><p className="micro-label">LA NOCHE SE ACERCA</p><Countdown/></div>
          <div className="hero-invitation"><img className="hero-seal" src={`${identity}nocturne-seal.svg`} alt="" aria-hidden="true"/><p className="party-context">Fiesta universitaria<br/>en una casa.</p><p className="dress-note">Disfraz recomendado. No obligatorio.</p><HalloweenButton href={instagram}>Quiero estar ahí</HalloweenButton><a href={calendarUrl} target="_blank" rel="noreferrer" className="calendar-link">Añadir a mi calendario <span aria-hidden="true">↗</span></a></div>
        </div>
        <a className="hero-scroll" href="#la-casa"><span aria-hidden="true">↓</span> Entra en la noche</a>
      </section>
      <ScrollStory/>
      <section className="archive section wrapper" id="archive">
        <div className="section-heading" data-reveal><div><p className="micro-label">01 / EL ARCHIVO</p><p className="section-note">Las noches pasan.<br/>Los recuerdos se quedan.</p></div><h2>NOCHES<br/><span>PASADAS</span><img src={`${identity}four-point-star.svg`} alt="" aria-hidden="true"/></h2></div>
        <div className="archive-gallery">{parties.map((party, i) => <article className="archive-card" key={party.id}><div className="archive-image">{party.cover && <img src={party.cover} alt={party.title} loading="lazy" width="900" height="1200"/>}<span className="frame-index">PH—0{i+1}</span><span className="archive-image-line" aria-hidden="true"/></div><div className="archive-caption"><h3>{party.title}</h3><span>{party.demo ? 'VISTA PREVIA' : party.year}</span></div></article>)}</div>
      </section>
      <section className="admission section wrapper" id="rsvp">
        <div className="section-heading" data-reveal><div><p className="micro-label">02 / TU INVITACIÓN</p><h2>ENTRA A<br/><span>LA LISTA.</span></h2></div><p>Lo que pasa en The Pink House<br/>podría terminar en el archivo.</p></div>
        <div className="ticket" data-reveal><div className="ticket-main"><div className="ticket-topline"><p className="eyebrow">THE PINK HOUSE</p><img src={`${identity}night-wing.svg`} alt="" aria-hidden="true"/></div><h3>HALLOWEEN</h3><p className="ticket-date">22.10.26 <span>/ FIESTA UNIVERSITARIA EN UNA CASA</span></p><dl><div><dt>Ubicación</dt><dd>{event.locationLabel}</dd></div><div><dt>Vestimenta</dt><dd>Disfraz opcional</dd></div><div><dt>Hora</dt><dd>{event.eventTime ?? 'Por confirmar'}</dd></div></dl></div><div className="ticket-stub"><p className="eyebrow">UNA SOLA NOCHE</p><div className="barcode" aria-hidden="true"/><p>Tu nombre en la lista.<br/><small>@{event.instagramUsername}</small></p><HalloweenButton href={instagram}>Confirmar por Instagram</HalloweenButton></div></div>
      </section>
    </main>
    <footer className="footer wrapper"><div className="footer-top"><p>CASA PRIVADA.<br/>RECUERDOS COMPARTIDOS.</p><img src={`${identity}night-wing.svg`} alt="" aria-hidden="true"/></div><a href="#top" className="footer-brand">THE PINK HOUSE</a><div className="footer-bottom"><span>© 2026 dmataguerra</span><a href="#top">Volver arriba ↑</a></div></footer>
  </div>;
}
