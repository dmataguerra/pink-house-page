import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import HeroLanding from './components/HeroLanding';
import HeroInterface from './components/HeroInterface';
import AttendanceModal from './components/AttendanceModal';
import PrizeModal from './components/PrizeModal';
import Editorial from './sections/Editorial';
import AdmissionTicket from './sections/AdmissionTicket';
gsap.registerPlugin(ScrollTrigger);
export default function App() {
 const root = useRef<HTMLDivElement>(null);
 const [attendanceModalOpen,setAttendanceModalOpen] = useState(false);
 const [prizeModalOpen,setPrizeModalOpen] = useState(false);
 const confirmAttendance = () => setAttendanceModalOpen(true);
 useLayoutEffect(() => {
  const context = gsap.context(() => {
   const mm = gsap.matchMedia();
   mm.add('(prefers-reduced-motion: no-preference)',() => {
    gsap.from('.hero-word',{yPercent:-50,opacity:0,duration:.5,stagger:.1,ease:'power1.out'});
    gsap.from('.hero-description, .hero-tagline',{yPercent:-50,opacity:0,duration:.5,delay:.25,ease:'power1.out'});
    gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach(element => gsap.from(element,{
     y:28,opacity:0,duration:1,ease:'power2.out',scrollTrigger:{trigger:element,start:'top 92%',once:true},
    }));
   });
   return () => mm.revert();
  },root);
  return () => context.revert();
 },[]);
 return <div ref={root}>
  <HeroInterface onConfirm={confirmAttendance}/>
  <main>
   <HeroLanding onConfirm={confirmAttendance}/>
   <Editorial onConfirm={confirmAttendance} onSchedule={() => setPrizeModalOpen(true)}/>
   <AdmissionTicket onConfirm={confirmAttendance} onSchedule={() => setPrizeModalOpen(true)}/>
  </main>
  <footer className="footer"><div className="footer-main">
   <div><a href="#top" className="footer-brand" aria-label="Volver al inicio">THE PINK HOUSE</a><p className="footer-credit">© 2026 dmataguerra</p></div>
   <a href="#top" className="footer-back-top">Volver arriba ↑</a>
  </div></footer>
  <AttendanceModal open={attendanceModalOpen} onClose={() => setAttendanceModalOpen(false)}/>
  <PrizeModal open={prizeModalOpen} onClose={() => setPrizeModalOpen(false)}/>
 </div>;
}

