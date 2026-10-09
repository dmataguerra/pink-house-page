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
  const confirmAttendance = () => setAttendanceModalOpen(true);

  useLayoutEffect(() => {
    const context = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach(element => gsap.from(element, {
          y: 24, opacity: 0, duration: .7, ease: 'power2.out',
          scrollTrigger: { trigger: element, start: 'top 92%', once: true },
        }));
      });
      return () => mm.revert();
    }, root);
    return () => context.revert();
  }, []);

  return <div ref={root}>
    <HeroInterface/>
    <main>
      <HeroLanding onConfirm={confirmAttendance}/>
      <Archive/>
      <section className="admission section wrapper" id="rsvp" aria-labelledby="admission-title">
        <div className="section-heading" data-reveal>
          <div>
            <p className="section-eyebrow">02 / Tu entrada</p>
            <h2 className="section-title" id="admission-title">Tu lugar<br/>en la casa.</h2>
          </div>
          <div className="section-description">
            <p>Lo que pasa en The Pink House<br/>se queda en la Pink House.</p>
            <button type="button" className="button" onClick={confirmAttendance} aria-haspopup="dialog" aria-controls="attendance-modal">Confirmar asistencia <span aria-hidden="true">↗</span></button>
          </div>
        </div>
        <MummyTicket onConfirm={confirmAttendance} onWin={() => setPrizeModalOpen(true)}/>
      </section>
    </main>
    <footer className="footer wrapper">
      <div className="footer-main">
        <a href="#top" className="footer-brand" aria-label="Volver al inicio">
          <img src={`${import.meta.env.BASE_URL}images/pink-house-wordmark.svg`} alt="PINK HOUSE" width="860" height="260" loading="lazy"/>
        </a>
        <p>Nos vemos en la casa.</p>
      </div>
      <div className="footer-bottom"><span>© 2026 dmataguerra</span><a href="#top">Volver arriba ↑</a></div>
    </footer>
    <AttendanceModal open={attendanceModalOpen} onClose={() => setAttendanceModalOpen(false)}/>
    <PrizeModal open={prizeModalOpen} onClose={() => setPrizeModalOpen(false)}/>
  </div>;
}
