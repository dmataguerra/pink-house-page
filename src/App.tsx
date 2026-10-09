import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Archive from './sections/Archive';
import HeroLanding from './components/HeroLanding';
import HeroInterface from './components/HeroInterface';
import AttendanceModal from './components/AttendanceModal';
import MummyTicket from './components/MummyTicket';
import PrizeModal from './components/PrizeModal';
gsap.registerPlugin(ScrollTrigger);
export default function App() {
  const root = useRef<HTMLDivElement>(null);
  const [attendanceModalOpen, setAttendanceModalOpen] = useState(false);
  const [prizeModalOpen, setPrizeModalOpen] = useState(false);
  useLayoutEffect(() => {
    const context = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach(element => gsap.from(element,{y:40,opacity:0,duration:.9,ease:'power3.out',scrollTrigger:{trigger:element,start:'top 90%',once:true}}));
      });
      return () => mm.revert();
    },root);
    return () => context.revert();
  },[]);
  return <div ref={root}><HeroInterface/><main>
    <HeroLanding onConfirm={() => setAttendanceModalOpen(true)}/>
    <Archive onConfirm={() => setAttendanceModalOpen(true)}/>
    <section className="admission section wrapper" id="rsvp" aria-labelledby="admission-title">
      <div className="section-heading" data-reveal>
        <div><p className="section-eyebrow"><span aria-hidden="true"/>ASISTENCIA</p><h2 id="admission-title">ENTRA A<br/>LA LISTA</h2><button type="button" className="attendance-link" onClick={() => setAttendanceModalOpen(true)} aria-haspopup="dialog" aria-controls="attendance-modal">Guárdame un lugar <span aria-hidden="true">↗</span></button></div>
        <p>Lo que pasa en The Pink House<br/>se queda en la Pink House.</p>
      </div>
      <MummyTicket onConfirm={() => setAttendanceModalOpen(true)} onWin={() => setPrizeModalOpen(true)}/>
    </section>
  </main>
    <footer className="footer wrapper">
      <a href="#top" className="footer-brand" aria-label="Volver al inicio"><img src={`${import.meta.env.BASE_URL}images/pink-house-wordmark-gradient.svg`} alt="PINK HOUSE" width="860" height="260" loading="lazy"/></a>
      <div className="footer-bottom"><span>© 2026 dmataguerra</span><button type="button" className="attendance-link" onClick={() => setAttendanceModalOpen(true)} aria-haspopup="dialog" aria-controls="attendance-modal">¿Te sumas? <span aria-hidden="true">↗</span></button><a href="#top">Volver arriba ↑</a></div>
    </footer>
    <AttendanceModal open={attendanceModalOpen} onClose={() => setAttendanceModalOpen(false)}/><PrizeModal open={prizeModalOpen} onClose={() => setPrizeModalOpen(false)}/></div>;
}
