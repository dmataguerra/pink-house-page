import SiteModal from './SiteModal';
import { useState } from 'react';
import { event } from '../config/event';

type Props = { onConfirm: () => void; onSchedule: () => void; onTicket: () => void };

export default function AfterDarkHeader({ onConfirm, onSchedule, onTicket }: Props) {
  const [open, setOpen] = useState(false);
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
        <a href="#countdown" onClick={() => setOpen(false)}>Cuenta regresiva <span>↓</span></a>
        <a href="#event-start" onClick={() => setOpen(false)}>Fecha y hora <span>8:00 PM</span></a>
      </nav><div className="ad-menu-actions"><h3>THE PINK HOUSE</h3><button onClick={() => afterClose(onConfirm)} aria-haspopup="dialog" aria-controls="attendance-modal">Confirmar asistencia ↗</button><button onClick={() => afterClose(onSchedule)} aria-haspopup="dialog" aria-controls="prize-modal">El plan de la noche ↗</button><button onClick={() => afterClose(onTicket)} aria-haspopup="dialog" aria-controls="ticket-modal">Tu entrada ↗</button><a href={`https://www.instagram.com/${event.instagramUsername}/`} target="_blank" rel="noopener noreferrer">Instagram ↗</a><p>Halloween 2026<br/>22 de octubre · Inicio 8:00 PM<br/>Hora del centro de México</p></div></div>
    </SiteModal>
  </>;
}
