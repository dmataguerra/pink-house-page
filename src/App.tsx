import { useState } from 'react';
import AfterDarkHeader from './components/AfterDarkHeader';
import Countdown from './components/Countdown';
import AttendanceModal from './components/AttendanceModal';
import PrizeModal from './components/PrizeModal';
import SiteModal from './components/SiteModal';
import MummyTicket from './components/MummyTicket';
import OpeningCollage from './components/OpeningCollage';
import { countdownDate } from './config/event';
import './components/EventLanding.css';

export default function App() {
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const onConfirm = () => { setScheduleOpen(false); setTicketOpen(false); setAttendanceOpen(true); };
  const onSchedule = () => { setAttendanceOpen(false); setTicketOpen(false); setScheduleOpen(true); };
  const onTicket = () => { setAttendanceOpen(false); setScheduleOpen(false); setTicketOpen(true); };

  return <div className="after-dark-site">
    <OpeningCollage/>
    <a className="skip-link" href="#main">Ir al contenido</a>
    <AfterDarkHeader onConfirm={onConfirm} onSchedule={onSchedule} onTicket={onTicket}/>
    <main id="main" className="ad-page ad-event-page">
      <section className="ad-hero" id="top" aria-labelledby="event-title">
        <header className="ad-event-heading">
          <div className="ad-title-row"><h1 id="event-title">THE PINK HOUSE</h1></div>
          <div className="ad-date">HALLOWEEN</div>
          <button id="rsvp" className="ad-heading-cta" onClick={onConfirm} aria-haspopup="dialog" aria-controls="attendance-modal">CONFIRMAR ASISTENCIA <span aria-hidden="true">↗</span></button>
        </header>
        <div className="ad-event-countdown" id="countdown">
          <Countdown hoursOnly/>
          <div className="ad-event-start" id="event-start">
            <time dateTime={countdownDate().toISOString()}><span className="ad-event-day">22 OCTUBRE 2026</span><span className="ad-event-dot" aria-hidden="true">·</span><span className="ad-event-time">INICIO 8:00 PM</span></time>
            <p>HORA DEL CENTRO DE MÉXICO</p>
          </div>
        </div>
      </section>
    </main>
    <AttendanceModal open={attendanceOpen} onClose={() => setAttendanceOpen(false)}/>
    <PrizeModal open={scheduleOpen} onClose={() => setScheduleOpen(false)}/>
    <SiteModal id="ticket-modal" title="TU ENTRADA" open={ticketOpen} onClose={() => setTicketOpen(false)} className="ad-ticket-modal">
      {ticketOpen && <MummyTicket onConfirm={onConfirm} onWin={onSchedule}/>}
    </SiteModal>
  </div>;
}
