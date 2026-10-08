import { useEffect, useRef } from 'react';
import { event } from '../config/event';
import './AttendanceModal.css';

type AttendanceModalProps = {
  open: boolean;
  onClose: () => void;
};

function ExternalArrow() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export default function AttendanceModal({ open, onClose }: AttendanceModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.documentElement.style.overflow;
    const previousPadding = document.documentElement.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.documentElement.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      const padding = parseFloat(getComputedStyle(document.documentElement).paddingRight) || 0;
      document.documentElement.style.paddingRight = `${padding + scrollbarWidth}px`;
    }
    dialog.showModal();

    return () => {
      dialog.close();
      document.documentElement.style.overflow = previousOverflow;
      document.documentElement.style.paddingRight = previousPadding;
      previousFocus?.focus({ preventScroll: true });
    };
  }, [open]);

  return <dialog
    ref={dialogRef}
    id="attendance-modal"
    className="attendance-modal"
    aria-labelledby="attendance-modal-title"
    onCancel={e => { e.preventDefault(); onClose(); }}
    onClick={e => {
      if (e.target !== e.currentTarget) return;
      const bounds = e.currentTarget.getBoundingClientRect();
      if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) onClose();
    }}
  >
    <div className="attendance-modal-content">
      <header className="attendance-modal-header">
        <h2 id="attendance-modal-title">¿Nos vemos?</h2>
        <button type="button" className="attendance-modal-close" onClick={onClose} aria-label="Cerrar modal" autoFocus>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </header>
      <div className="attendance-options">
        <a className="attendance-option attendance-option-instagram" href={`https://www.instagram.com/${event.instagramUsername}/`} target="_blank" rel="noopener noreferrer" aria-label="Pedir ubicación en Instagram (se abre en una pestaña nueva)">
          <span className="attendance-option-media">
            <img className="attendance-profile-photo" src={`${import.meta.env.BASE_URL}images/instagram-profile.jpeg`} alt="David, anfitrión de The Pink House" width="720" height="1280"/>
          </span>
          <span className="attendance-option-body">
            <span className="attendance-option-title">Pedir ubicación</span>
            <span className="attendance-option-description">Por DM en Instagram</span>
          </span>
          <span className="attendance-option-arrow"><ExternalArrow/></span>
        </a>
        <a className="attendance-option attendance-option-confirm" href={event.attendanceUrl} target="_blank" rel="noopener noreferrer" aria-label="Confirmar asistencia (se abre en una pestaña nueva)">
          <span className="attendance-option-media">
            <img className="attendance-map-image" src={`${import.meta.env.BASE_URL}images/attendance-map.svg`} alt="" width="640" height="320"/>
          </span>
          <span className="attendance-option-body">
            <span className="attendance-option-title">Confirmar asistencia</span>
            <span className="attendance-option-description">Ya sé dónde es</span>
          </span>
          <span className="attendance-option-arrow"><ExternalArrow/></span>
        </a>
      </div>
    </div>
  </dialog>;
}
