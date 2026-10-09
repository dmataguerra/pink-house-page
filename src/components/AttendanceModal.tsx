import { event } from '../config/event';
import SiteModal from './SiteModal';

type AttendanceModalProps = {
  open: boolean;
  onClose: () => void;
};

function ExternalArrow() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export default function AttendanceModal({ open, onClose }: AttendanceModalProps) {
  return <SiteModal id="attendance-modal" title="¿Nos vemos?" open={open} onClose={onClose}>
      <div className="attendance-options">
        <a className="attendance-option attendance-option-instagram" href={`https://www.instagram.com/${event.instagramUsername}/`} target="_blank" rel="noopener noreferrer" aria-label="Pedir ubicación en Instagram (se abre en una pestaña nueva)">
          <span className="attendance-option-media">
            <img className="attendance-profile-photo" src={`${import.meta.env.BASE_URL}images/instagram-profile-cinematic.webp`} alt="David, anfitrión de The Pink House" width="720" height="1280"/>
          </span>
          <span className="attendance-option-body">
            <span className="attendance-option-title">Pedir ubicación</span>
            <span className="attendance-option-description">Por DM en Instagram</span>
          </span>
          <span className="attendance-option-arrow"><ExternalArrow/></span>
        </a>
        <a className="attendance-option attendance-option-confirm" href={event.attendanceUrl} target="_blank" rel="noopener noreferrer" aria-label="Confirmar asistencia (se abre en una pestaña nueva)">
          <span className="attendance-option-media">
            <img className="attendance-map-image" src={`${import.meta.env.BASE_URL}images/archive-location-documentary.webp`} alt="" width="640" height="320"/>
          </span>
          <span className="attendance-option-body">
            <span className="attendance-option-title">Confirmar asistencia</span>
            <span className="attendance-option-description">Ya sé dónde es</span>
          </span>
          <span className="attendance-option-arrow"><ExternalArrow/></span>
        </a>
      </div>
  </SiteModal>;
}
