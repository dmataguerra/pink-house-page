import { useState } from 'react';
import AfterDarkHeader from './components/AfterDarkHeader';
import AfterDarkLocation from './components/AfterDarkLocation';
import AttendanceModal from './components/AttendanceModal';
import PrizeModal from './components/PrizeModal';
import SiteModal from './components/SiteModal';
import MummyTicket from './components/MummyTicket';
import AfterDarkFAQ from './sections/AfterDarkFAQ';
import AfterDarkClosing from './sections/AfterDarkClosing';
import { event } from './config/event';
import OpeningCollage from './components/OpeningCollage';

const asset = (name: string) => `${import.meta.env.BASE_URL}images/${name}`;

export default function App() {
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapStart, setMapStart] = useState(0);
  const onConfirm = () => { setMapOpen(false); setScheduleOpen(false); setTicketOpen(false); setAttendanceOpen(true); };
  const onSchedule = () => { setMapOpen(false); setAttendanceOpen(false); setTicketOpen(false); setScheduleOpen(true); };
  const onTicket = () => { setMapOpen(false); setAttendanceOpen(false); setScheduleOpen(false); setTicketOpen(true); };
  const onMap = (startAt = 0) => { setAttendanceOpen(false); setScheduleOpen(false); setTicketOpen(false); setMapStart(startAt); setMapOpen(true); };

  return <div className="after-dark-site">
    <OpeningCollage/>
    <a className="skip-link" href="#main">Ir al contenido</a>
    <div className="ad-atmosphere" aria-hidden="true"/>
    <AfterDarkHeader onConfirm={onConfirm} onSchedule={onSchedule} onTicket={onTicket}/>
    <main id="main" className="ad-page">
      <section className="ad-hero" id="top" aria-labelledby="event-title">
        <header className="ad-event-heading">
          <div className="ad-title-row"><h1 id="event-title">THE PINK HOUSE</h1><span className="ad-edition">HALLOWEEN</span></div>
          <time className="ad-date" dateTime={`${event.eventDate}T${event.eventTime}:00${event.utcOffset}`}>22 OCT 2026</time>
          <button className="ad-heading-cta" onClick={onConfirm} aria-haspopup="dialog" aria-controls="attendance-modal">CONFIRMAR ASISTENCIA <span aria-hidden="true">↗</span></button>
        </header>
        <div className="ad-photo-pair">
          <img src={asset('after-dark-community-grain.webp')} alt="Manos de amigos reunidas en una fiesta de Halloween, en blanco y negro con grano de película" width="1254" height="1254"/>
          <img src={asset('after-dark-party-grain.webp')} alt="Amigos celebrando Halloween bajo una luz naranja y ámbar, con textura de película" width="1254" height="1254" fetchPriority="high"/>
        </div>
      </section>
      <section className="ad-about ad-numbered" id="about" aria-labelledby="about-title">
        <span className="ad-section-number">01</span><h2 className="ad-section-label" id="about-title">Sobre la noche</h2>
        <div className="ad-about-content">
          <button className="ad-pill" onClick={onConfirm} aria-haspopup="dialog" aria-controls="attendance-modal">¿NOS VEMOS? <span aria-hidden="true">↗</span></button>
          <div className="ad-big-copy">
            <p>La casa de siempre.<br/>Una noche diferente.</p>
            <p>Somos estudiantes que hacen pedas caseras. Este año quisimos subir el nivel. El 22 de octubre, The Pink House se transforma para una noche de Halloween entre amigos.</p>
            <p>Disfraces, música, juegos y un premio al mejor disfraz. Trae lo que te gusta tomar. También habrá bebidas de nuestra parte.</p>
            <p>Lo que pasa en la Pink House se queda en la Pink House.</p>
          </div>
        </div>
      </section>
      <AfterDarkLocation/>
      <section className="ad-facts ad-numbered" id="night" aria-labelledby="night-title">
        <span className="ad-section-number">02</span><h2 className="sr-only" id="night-title">Los detalles de la noche</h2>
        <dl className="ad-data-list">
          <div><dt>FECHA</dt><dd>22 de octubre de 2026</dd></div>
          <div><dt>INICIO</dt><dd>20:00 · Hora del centro de México</dd></div>
          <div><dt>DISFRAZ</dt><dd>Recomendado, no obligatorio</dd></div>
          <div><dt>CONCURSO</dt><dd>Premio al mejor disfraz de la noche</dd></div>
          <div><dt>BEBIDAS</dt><dd>Trae lo que te gusta tomar. También habrá bebidas de nuestra parte.</dd></div>
        </dl>
      </section>
      <section className="ad-plan ad-numbered" id="rsvp" aria-labelledby="plan-title">
        <span className="ad-section-number">03</span><h2 className="sr-only" id="plan-title">Cómo encontrarnos y qué te espera</h2>
        <dl className="ad-data-list ad-data-spaced">
          <div><dt>CÓMO ENCONTRARNOS</dt><dd>La ubicación se comparte al confirmar.<br/><button className="ad-inline-link" onClick={onConfirm}>Pedir ubicación <span aria-hidden="true">↗</span></button></dd></div>
          <div><dt>LO QUE TE ESPERA</dt><dd>Dinámicas &amp; Kahoot, concurso de disfraces, beer pong, foto grupal y batalla de Tilín insano.</dd></div>
          <div><dt>EL PLAN DE LA NOCHE</dt><dd>Empezamos a las 20:00. El resto de la noche lo hacemos juntos.<br/><button className="ad-inline-link" onClick={onSchedule}>Ver el plan <span aria-hidden="true">↗</span></button></dd></div>
        </dl>
      </section>
      <AfterDarkFAQ onConfirm={onConfirm} onSchedule={onSchedule}/>
    </main>
    <AfterDarkClosing onConfirm={onConfirm} onSchedule={onSchedule} onMap={() => onMap()}/>
    <AttendanceModal open={attendanceOpen} onClose={() => setAttendanceOpen(false)}/>
    <PrizeModal open={scheduleOpen} onClose={() => setScheduleOpen(false)}/>
    <SiteModal id="ticket-modal" title="TU ENTRADA" open={ticketOpen} onClose={() => setTicketOpen(false)} className="ad-ticket-modal">
      {ticketOpen && <MummyTicket onConfirm={onConfirm} onWin={onSchedule}/>}
    </SiteModal>
    <SiteModal id="hero-video-modal" title="JURIQUILLA, QUERÉTARO" open={mapOpen} onClose={() => setMapOpen(false)} className="ad-video-modal">
      {mapOpen && <video className="ad-video-full" src={`${import.meta.env.BASE_URL}videos/acercamiento-orbital.mp4?v=orbital-20261008`} autoPlay muted playsInline loop preload="auto" aria-label="Mapa 3D de Juriquilla" onLoadedMetadata={e => { e.currentTarget.currentTime = mapStart; }}/ >}
    </SiteModal>
  </div>;
}
