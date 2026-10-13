import SiteModal from './SiteModal';
import Countdown from './Countdown';
import { useEffect, useState } from 'react';

type Props = { onConfirm: () => void; onSchedule: () => void; onTicket: () => void };

export default function AfterDarkHeader({ onConfirm, onSchedule, onTicket }: Props) {
  const [open, setOpen] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);
  useEffect(() => {
    const footer = document.querySelector('.after-dark-closing');
    if (!footer) return;
    const observer = new IntersectionObserver(([entry]) => setFooterVisible(entry.isIntersecting));
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);
  const afterClose = (action: () => void) => { setOpen(false); window.setTimeout(action, 0); };
  return <>
    <header className="ad-header"><div className="ad-header-bar">
      <a href="#top" className="ad-brand" aria-label="The Pink House — volver al inicio"><img src={`${import.meta.env.BASE_URL}images/pink-house-after-dark-mark.svg`} alt="" /></a>
      <button className="ad-menu-button" onClick={() => setOpen(true)} aria-expanded={open} aria-controls="navigation-modal" aria-haspopup="dialog">MENÚ <span aria-hidden="true">☰</span></button>
    </div></header>
    <SiteModal id="navigation-modal" title="THE PINK HOUSE" open={open} onClose={() => setOpen(false)} className="ad-navigation-modal">
      <div className="ad-menu-grid"><nav aria-label="Navegación principal">
        <h3>EXPLORA LA NOCHE</h3>
        <a href="#top" onClick={() => setOpen(false)}>Inicio <span>22 OCT 2026</span></a>
        <a href="#about" onClick={() => setOpen(false)}>Sobre la noche <span>01</span></a>
        <a href="#location" onClick={() => setOpen(false)}>La locación <span>↗</span></a>
        <a href="#night" onClick={() => setOpen(false)}>Los detalles <span>02</span></a>
        <a href="#rsvp" onClick={() => setOpen(false)}>Cómo encontrarnos <span>03</span></a>
        <a href="#archive" onClick={() => setOpen(false)}>Fiestas pasadas <span>↓</span></a>
        <a href="#mapa" onClick={() => setOpen(false)}>Juriquilla <span>↗</span></a>
      </nav><div className="ad-menu-actions"><h3>THE PINK HOUSE</h3><button onClick={() => afterClose(onConfirm)}>Confirmar asistencia ↗</button><button onClick={() => afterClose(onSchedule)}>El plan de la noche ↗</button><button onClick={() => afterClose(onTicket)}>Tu entrada ↗</button><a href="https://www.instagram.com/david_mata_g/" target="_blank" rel="noreferrer">Instagram ↗</a><p>Halloween 2026<br/>22 de octubre · Desde las 20:00</p></div></div>
    </SiteModal>
    <aside className={`ad-status${footerVisible ? ' ad-status-hidden' : ''}`} aria-label="Información del evento" aria-hidden={footerVisible}><div className="ad-status-countdown"><span>FALTA:</span><Countdown/></div><div><span>FECHA</span><strong>22 OCT 2026</strong></div><div><span>INICIO</span><strong>20:00</strong></div></aside>
  </>;
}
