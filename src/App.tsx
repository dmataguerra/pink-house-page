import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ScrollStory from './sections/ScrollStory';
import Countdown from './components/Countdown';
import { event } from './config/event';
import { parties } from './data/parties';
gsap.registerPlugin(ScrollTrigger);
export default function App() {
  const root = useRef<HTMLDivElement>(null);
  const [showFloatingCountdown, setShowFloatingCountdown] = useState(false);
  const instagram = `https://www.instagram.com/${event.instagramUsername}/`;
  useLayoutEffect(() => {
    const context = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const cards = gsap.utils.toArray<HTMLElement>('.archive-card');
        gsap.matchMedia().add('(min-width: 601px)', () => {
          gsap.from(cards,{opacity:0,y:50,scale:.985,duration:.8,stagger:.15,ease:'power3.out',scrollTrigger:{trigger:'.archive-gallery',start:'top 85%',once:true}});
        }).add('(max-width: 600px)', () => {
          cards.forEach(card => gsap.from(card,{opacity:0,y:50,scale:.985,duration:.8,ease:'power3.out',scrollTrigger:{trigger:card,start:'top 90%',once:true}}));
        });
        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach(element => gsap.from(element,{y:40,opacity:0,duration:.9,ease:'power3.out',scrollTrigger:{trigger:element,start:'top 90%',once:true}}));
      });
      return () => mm.revert();
    },root);
    return () => context.revert();
  },[]);
  useEffect(() => {
    const updateFloatingCountdown = () => {
      const hero = root.current?.querySelector('.hero');
      setShowFloatingCountdown(!!hero && hero.getBoundingClientRect().bottom <= 0);
    };
    updateFloatingCountdown();
    window.addEventListener('scroll', updateFloatingCountdown, { passive: true });
    window.addEventListener('resize', updateFloatingCountdown);
    return () => {
      window.removeEventListener('scroll', updateFloatingCountdown);
      window.removeEventListener('resize', updateFloatingCountdown);
    };
  },[]);
  const calendarUrl = 'https://calendar.app.google/HCNWJHqhFCBNuWdn9';
  const rsvp = (label = 'CONFIRMAR POR INSTAGRAM', pink = false, href = instagram, showArrow = true) => <span className="button-group"><a className={`button ${pink ? 'button-pink' : ''}`} href={href} target="_blank" rel="noreferrer">{label}</a>{showArrow && <a className="button-arrow" href={href} target="_blank" rel="noreferrer" aria-label={label}>›</a>}</span>;
  return <div ref={root} className={showFloatingCountdown ? "has-floating-countdown" : undefined}><header className="site-nav wrapper" id="top"><a href="#top" className="brand"><img src="/images/pink-house-logo.png" alt="THE PINK HOUSE"/></a><div className="nav-right"><span>22.10.26</span>{rsvp('CONFIRMAR')}</div></header>{showFloatingCountdown && <div className="floating-countdown"><Countdown/></div>}<main>
    <section className="hero wrapper"><div className="hero-title" data-reveal><h1>HALLOWEEN<br/>EN THE<br/>PINK HOUSE</h1><div className="hero-meta"><span>EVENTO EL</span><strong>22 DE OCTUBRE DE 2026</strong></div></div><div className="hero-side" data-reveal><div><Countdown/></div><div className="hero-rsvp"><p>Disfraz recomendado.<br/><span>No obligatorio.</span></p>{rsvp('Añadir a mi calendario', true, calendarUrl, false)}</div></div></section>
    <ScrollStory/>
    <section className="archive section wrapper" id="archive"><div className="section-heading" data-reveal><p>El archivo.<br/>Recuerdos compartidos.</p><h2>NOCHES PASADAS</h2></div><div className="archive-gallery">{parties.map(party=><article className="archive-card" key={party.id}><div className="archive-image">{party.cover && <img src={party.cover} alt={party.title} loading="lazy"/>}</div><h3>{party.title}</h3></article>)}</div></section>
    <section className="admission section wrapper" id="rsvp"><div className="section-heading" data-reveal><h2>ENTRA A<br/>LA LISTA</h2><p>Lo que pasa en The Pink House<br/>podría terminar en el archivo.</p></div><div className="ticket" data-reveal><div className="ticket-main"><p className="eyebrow">THE PINK HOUSE</p><h3>HALLOWEEN</h3><p className="ticket-date">22.10.26</p><dl><div><dt>Ubicación</dt><dd>{event.locationLabel}</dd></div><div><dt>Vestimenta</dt><dd>Opcional</dd></div><div><dt>Hora</dt><dd>{event.eventTime ?? 'POR CONFIRMAR'}</dd></div></dl></div><div className="ticket-stub"><p className="eyebrow">UNA SOLA NOCHE</p><div className="barcode" aria-hidden="true"/><p>Mensaje directo por Instagram<br/><small>@{event.instagramUsername}</small></p>{rsvp('CONFIRMAR POR INSTAGRAM',true)}</div></div></section>
  </main><footer className="footer wrapper"><div className="footer-top"><p>CASA PRIVADA.<br/>RECUERDOS COMPARTIDOS.</p></div><a href="#top" className="footer-brand">THE PINK HOUSE</a><div className="footer-bottom"><span>© 2026 dmataguerra</span><a href="#top">Volver arriba ↑</a></div></footer></div>;
}

