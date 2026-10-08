import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ScrollStory from './sections/ScrollStory';
import Countdown from './components/Countdown';
import AttendanceModal from './components/AttendanceModal';
import MummyTicket from './components/MummyTicket';
import PrizeModal from './components/PrizeModal';
import { event } from './config/event';
import { parties } from './data/parties';
gsap.registerPlugin(ScrollTrigger);
export default function App() {
  const root = useRef<HTMLDivElement>(null);
  const [showFloatingCountdown, setShowFloatingCountdown] = useState(false);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [prizeModalOpen, setPrizeModalOpen] = useState(false);
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
  const rsvp = (label = 'CONFIRMAR ASISTENCIA', pink = false) => <span className="button-group"><button type="button" className={`button ${pink ? 'button-pink' : ''}`} onClick={() => setAttendanceModalOpen(true)} aria-haspopup="dialog" aria-controls="attendance-modal">{label}</button><button type="button" className="button-arrow" onClick={() => setAttendanceModalOpen(true)} aria-label={label} aria-haspopup="dialog" aria-controls="attendance-modal">›</button></span>;
  return <div ref={root} className={showFloatingCountdown ? "has-floating-countdown" : undefined}><header className="site-nav wrapper" id="top"><a href="#top" className="brand"><img className="brand-logo" src={`${import.meta.env.BASE_URL}images/pink-house-logo.png`} alt="THE PINK HOUSE"/></a><div className="nav-right"><span>22.10.26</span>{rsvp('CONFIRMAR')}</div></header>{showFloatingCountdown && <div className="floating-countdown"><Countdown/></div>}<main>
    <section className="hero wrapper"><div className="hero-title" data-reveal><h1>HALLOWEEN<br/>EN THE<br/>PINK HOUSE</h1><div className="hero-meta"><span>EVENTO EL</span><strong>22 DE OCTUBRE DE 2026</strong></div></div><div className="hero-side" data-reveal><div><Countdown/></div><div className="hero-rsvp"><p>Disfraz recomendado.<br/><span>No obligatorio.</span></p><span className="button-group"><a className="button button-pink" href={event.attendanceUrl} target="_blank" rel="noopener noreferrer">Añadir a mi calendario</a></span></div></div></section>
    <ScrollStory/>
    <section className="archive section wrapper" id="archive"><div className="section-heading" data-reveal><p>El archivo.<br/>Recuerdos compartidos.</p><h2>NOCHES PASADAS</h2></div><div className="archive-gallery">{parties.map(party=><article className="archive-card" key={party.id} aria-label={party.title}><div className="archive-image">{party.cover && <img src={party.cover} alt={party.title} loading="lazy"/>}{party.id === 'memory-03' && <img className="archive-hanging-mummy" src={`${import.meta.env.BASE_URL}images/mummy-hanging.png`} alt="" aria-hidden="true"/>}</div></article>)}</div></section>
    <section className="admission section wrapper" id="rsvp"><div className="section-heading" data-reveal><h2>ENTRA A<br/>LA LISTA</h2><p>Lo que pasa en The Pink House<br/>podría terminar en el archivo.</p></div><MummyTicket onConfirm={() => setAttendanceModalOpen(true)} onWin={() => setPrizeModalOpen(true)}/></section>
  </main><footer className="footer wrapper"><a href="#top" className="footer-brand" aria-label="Volver al inicio"><img src={`${import.meta.env.BASE_URL}images/pink-house-logo.png`} alt="THE PINK HOUSE"/></a><div className="footer-bottom"><span>© 2026 dmataguerra</span><a href="#top">Volver arriba ↑</a></div></footer><AttendanceModal open={attendanceModalOpen} onClose={() => setAttendanceModalOpen(false)}/><PrizeModal open={prizeModalOpen} onClose={() => setPrizeModalOpen(false)}/></div>;
}
