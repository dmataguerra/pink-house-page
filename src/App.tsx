import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import ScrollStory from './sections/ScrollStory';
import HeroLanding from './components/HeroLanding';
import HeroInterface from './components/HeroInterface';
import AttendanceModal from './components/AttendanceModal';
import MummyTicket from './components/MummyTicket';
import PrizeModal from './components/PrizeModal';
import { parties } from './data/parties';
gsap.registerPlugin(ScrollTrigger);
export default function App() {
  const root = useRef<HTMLDivElement>(null);
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
  return <div ref={root}><HeroInterface/><main>
    <HeroLanding onConfirm={() => setAttendanceModalOpen(true)}/>
    <ScrollStory/>
    <section className="archive section wrapper" id="archive"><div className="section-heading" data-reveal><p>El archivo.<br/>Recuerdos compartidos.</p><h2>FIESTA DE DISFRACES</h2></div><div className="archive-gallery">{parties.map(party=><article className="archive-card" key={party.id} aria-label={party.title}><div className="archive-image">{party.cover && <img src={party.cover} alt={party.title} loading="lazy"/>}</div></article>)}</div></section>
    <section className="admission section wrapper" id="rsvp"><div className="section-heading" data-reveal><h2>ENTRA A<br/>LA LISTA</h2><p>Lo que pasa en The Pink House<br/>podría terminar en el archivo.</p></div><MummyTicket onConfirm={() => setAttendanceModalOpen(true)} onWin={() => setPrizeModalOpen(true)}/></section>
  </main><footer className="footer wrapper"><a href="#top" className="footer-brand" aria-label="Volver al inicio">PINK HOUSE</a><div className="footer-bottom"><span>© 2026 dmataguerra</span><a href="#top">Volver arriba ↑</a></div></footer><AttendanceModal open={attendanceModalOpen} onClose={() => setAttendanceModalOpen(false)}/><PrizeModal open={prizeModalOpen} onClose={() => setPrizeModalOpen(false)}/></div>;
}
