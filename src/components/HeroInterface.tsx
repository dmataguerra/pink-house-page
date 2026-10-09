import { useState } from 'react';
import Countdown from './Countdown';
import SiteModal from './SiteModal';
import './HeroLanding.css';
export default function HeroInterface({ onConfirm }: { onConfirm: () => void }) {
 const [open,setOpen] = useState(false);
 return <>
  <header className="hero-interface" aria-label="Halloween en Pink House">
   <div className="hero-header">
    <a href="#top" className="hero-header-logo" aria-label="Pink House — volver al inicio">THE PINK HOUSE</a>
    <button type="button" className="hero-menu-button" aria-label="Abrir menú" aria-expanded={open} aria-controls="navigation-modal" aria-haspopup="dialog" onClick={() => setOpen(true)}/>
   </div>
  </header>
  <SiteModal id="navigation-modal" title="The Pink House" open={open} onClose={() => setOpen(false)} className="navigation-modal">
   <nav className="hero-navigation" aria-label="Navegación principal">
    <a href="#top" onClick={() => setOpen(false)}>Inicio</a>
    <a href="#archive" onClick={() => setOpen(false)}>La casa</a>
    <a href="#night" onClick={() => setOpen(false)}>La noche</a>
    <a href="#rsvp" onClick={() => setOpen(false)}>Tu entrada</a>
    <button type="button" onClick={() => {setOpen(false);window.setTimeout(onConfirm,0);}}>Confirmar asistencia ↗</button>
   </nav>
   <div className="menu-countdown"><p>22.10.2026 / 20:00</p><Countdown/></div>
  </SiteModal>
 </>;
}

