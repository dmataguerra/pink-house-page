import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { event } from '../config/event';
import './MummyTicket.css';

type MummyTicketProps = {
  onConfirm: () => void;
  onWin: () => void;
};

function Scissors() {
  return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <circle cx="8" cy="7" r="4" stroke="currentColor" strokeWidth="1.8"/>
    <circle cx="24" cy="7" r="4" stroke="currentColor" strokeWidth="1.8"/>
    <path d="m11 10 13 18M21 10 8 28" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    <circle cx="16" cy="17" r="1.4" fill="currentColor"/>
  </svg>;
}

function Mummy() {
  return <svg className="mummy-illustration" viewBox="0 0 300 390" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
    <path d="M-25 31C79-1 196 51 329 14L324 98C183 143 66 88-22 121Z" fill="#e4dfd7" stroke="#222123" strokeWidth="3.5"/>
    <path d="M-20 13C102 44 176-3 327 48M-20 109C85 85 164 105 321 69" stroke="#222123" strokeWidth="3.5"/>
    <path d="M-21 115C86 103 207 91 322 70L321 188C192 146 101 187-20 165Z" fill="#f1ede8" stroke="#222123" strokeWidth="3.5"/>
    <path d="M-20 135C111 160 215 109 323 130" stroke="#222123" strokeWidth="3.5"/>
    <path d="M-6 197C32 157 101 152 149 173c50-23 116-24 158 13v99H-6Z" fill="#222123"/>
    <path className="mummy-eye" d="M27 181c22-13 59-16 85-6 21 8 28 32 22 55-8 30-29 44-57 43-36-1-62-26-61-52 0-16 3-31 11-40Z" fill="#ff4f91" stroke="#222123" strokeWidth="4.5"/>
    <path className="mummy-eye" d="M178 176c29-13 63-12 87 4 19 13 24 37 16 59-10 30-35 42-64 35-28-6-50-25-52-49-2-21 1-39 13-49Z" fill="#ff4f91" stroke="#222123" strokeWidth="4.5"/>
    <ellipse cx="86" cy="248" rx="10" ry="12" fill="#222123"/>
    <ellipse cx="234" cy="248" rx="10" ry="12" fill="#222123"/>
    <path d="M-21 278c110 29 228 19 342-17v65C183 317 56 359-21 332Z" fill="#f1ede8" stroke="#222123" strokeWidth="3.5"/>
    <path d="M-23 343c97-29 224-11 345-35v98H-23Z" fill="#e4dfd7" stroke="#222123" strokeWidth="3.5"/>
    <path d="M-20 345c115 7 225 50 342 30M-10 410c126-27 232-13 331-31" stroke="#222123" strokeWidth="3.5"/>
    <path d="m34 60 12-4m-10 9 18-5m208 274 13-4m-16 10 18-5M20 285l-8-5m14 11-17-9" stroke="#222123" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>;
}

export default function MummyTicket({ onConfirm, onWin }: MummyTicketProps) {
  const [year, month, day] = event.eventDate.split('-');
  const ticketDate = `${day}.${month}.${year.slice(-2)}`;
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'intact' | 'cutting' | 'cut'>('intact');
  const gesture = useRef<{ direction: 1 | -1; start: number; last: number; progress: number; pointerId: number } | null>(null);
  const complete = useRef(false);
  const revealTimer = useRef<number | undefined>(undefined);
  const cutButton = useRef<HTMLButtonElement>(null);

  useEffect(() => () => window.clearTimeout(revealTimer.current), []);

  function finishCut() {
    if (complete.current) return;
    complete.current = true;
    gesture.current = null;
    setProgress(1);
    setPhase('cutting');
    cutButton.current?.focus({ preventScroll: true });
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    revealTimer.current = window.setTimeout(() => {
      setPhase('cut');
      onWin();
    }, reduceMotion ? 0 : 650);
  }

  function position(e: PointerEvent<HTMLButtonElement>) {
    const bounds = e.currentTarget.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientY - bounds.top) / bounds.height));
  }

  function startGesture(e: PointerEvent<HTMLButtonElement>) {
    if (complete.current || !e.isPrimary) return;
    const start = position(e);
    // Begin at either end so crossing the dotted line cannot accidentally win.
    if (start > .14 && start < .86) return;
    gesture.current = { direction: start < .5 ? 1 : -1, start, last: start, progress: 0, pointerId: e.pointerId };
    setProgress(0);
  }

  function moveGesture(e: PointerEvent<HTMLButtonElement>) {
    if (complete.current) return;
    if (!gesture.current && e.pointerType === 'mouse') startGesture(e);
    const active = gesture.current;
    if (!active || active.pointerId !== e.pointerId) return;
    const bounds = e.currentTarget.getBoundingClientRect();
    if (e.clientX < bounds.left - 20 || e.clientX > bounds.right + 20) {
      resetGesture();
      return;
    }
    const next = position(e);
    // Ignore jumps: the pointer must actually travel along the perforation.
    if (Math.abs(next - active.last) > .28) {
      resetGesture();
      return;
    }
    active.last = next;
    const distance = (next - active.start) * active.direction;
    active.progress = Math.max(active.progress, Math.min(1, distance / .84));
    setProgress(active.progress);
    if (active.progress >= 1) finishCut();
  }

  function resetGesture() {
    gesture.current = null;
    if (!complete.current) setProgress(0);
  }

  const style = {
    '--cut-progress': `${progress * 100}%`,
    '--scissors-position': `${gesture.current?.direction === -1 ? 100 - progress * 100 : progress * 100}%`,
  } as CSSProperties;

  return <div className={`mummy-ticket-stage mummy-ticket-${phase}`} data-reveal style={style}>
    <p className="ticket-cut-hint" id="ticket-cut-instructions">
      <span>{phase === 'cut' ? 'Ver mi premio' : 'Desliza para cortar'}</span>
      <svg viewBox="0 0 18 24" fill="none" aria-hidden="true"><path d="M9 1v20m-6-6 6 6 6-6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </p>
    <div className="mummy-ticket">
      <div className="mummy-ticket-main">
        <div className="mummy-ticket-character"><Mummy/></div>
        <div className="mummy-ticket-details">
          <p className="mummy-ticket-brand">THE PINK HOUSE</p>
          <h3 className="mummy-ticket-title" aria-label="Halloween">HALLO<br/>WEEN</h3>
          <p className="mummy-ticket-date">{ticketDate}</p>
        </div>
      </div>
      <div className="mummy-ticket-stub">
        <p className="mummy-ticket-stub-title">Trick<br/>or treat</p>
        <button className="mummy-ticket-confirm" type="button" onClick={onConfirm} aria-haspopup="dialog" aria-controls="attendance-modal">CONFIRMAR <span aria-hidden="true">↗</span></button>
      </div>
      <button
        ref={cutButton}
        type="button"
        className="ticket-cut-control"
        aria-label={phase === 'cut' ? 'Ver mi premio' : 'Cortar ticket y descubrir mi premio'}
        aria-describedby="ticket-cut-instructions"
        aria-controls="prize-modal"
        aria-haspopup="dialog"
        aria-disabled={phase === 'cutting'}
        onPointerEnter={e => { if (e.pointerType === 'mouse') startGesture(e); }}
        onPointerDown={e => {
          if (e.pointerType === 'mouse' || complete.current) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          startGesture(e);
        }}
        onPointerMove={moveGesture}
        onPointerLeave={e => { if (e.pointerType === 'mouse') resetGesture(); }}
        onPointerUp={e => { if (e.pointerType !== 'mouse') resetGesture(); }}
        onPointerCancel={resetGesture}
        onLostPointerCapture={resetGesture}
        onKeyDown={e => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          if (phase === 'cut') onWin(); else finishCut();
        }}
        onClick={() => { if (phase === 'cut') onWin(); }}
      >
        <span className="ticket-perforation" aria-hidden="true"/>
        <span className="ticket-cut-trail" style={gesture.current?.direction === -1 ? {top: 'auto', bottom: 0} : undefined} aria-hidden="true"/>
        <span className={`ticket-scissors ${progress > 0 ? 'is-cutting' : ''}`}><Scissors/></span>
      </button>
    </div>
    <span className="ticket-cut-status" role="status">{phase === 'cut' ? 'Ticket cortado. Te has ganado un premio.' : ''}</span>
  </div>;
}
