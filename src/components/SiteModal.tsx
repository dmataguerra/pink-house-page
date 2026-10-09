import { useEffect, useRef, type ReactNode } from 'react';
import './AttendanceModal.css';

type SiteModalProps = {
  id: string;
  title: string;
  open: boolean;
  onClose: () => void;
  children?: ReactNode;
  className?: string;
};

export default function SiteModal({ id, title, open, onClose, children, className = '' }: SiteModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backdropPointerDown = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    backdropPointerDown.current = false;

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
    id={id}
    className={`attendance-modal ${className}`}
    aria-modal="true"
    aria-labelledby={`${id}-title`}
    onCancel={e => { e.preventDefault(); onClose(); }}
    onPointerDown={e => {
      const bounds = e.currentTarget.getBoundingClientRect();
      backdropPointerDown.current = e.target === e.currentTarget && (
        e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom
      );
    }}
    onClick={e => {
      if (e.target !== e.currentTarget || !backdropPointerDown.current) return;
      backdropPointerDown.current = false;
      const bounds = e.currentTarget.getBoundingClientRect();
      if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) onClose();
    }}
  >
    <div className="attendance-modal-content">
      <header className="attendance-modal-header">
        <h2 id={`${id}-title`}>{title}</h2>
        <button type="button" className="attendance-modal-close" onClick={onClose} onPointerUp={e => {
          if (e.pointerType !== 'touch') return;
          const bounds = e.currentTarget.getBoundingClientRect();
          if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) return;
          window.setTimeout(() => {
            if (dialogRef.current?.open) onClose();
          }, 0);
        }} aria-label="Cerrar modal" autoFocus>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </header>
      {children}
    </div>
  </dialog>;
}
