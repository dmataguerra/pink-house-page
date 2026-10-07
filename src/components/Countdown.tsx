import { useEffect, useState } from 'react';
import { countdownDate, event } from '../config/event';
export default function Countdown() {
  const [remaining, setRemaining] = useState(() => Math.max(0, countdownDate().getTime() - Date.now()));
  useEffect(() => { const timer = window.setInterval(() => setRemaining(Math.max(0, countdownDate().getTime() - Date.now())), 1000); return () => clearInterval(timer); }, []);
  const seconds = Math.floor(remaining / 1000);
  const values = [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60];
  return <div className="countdown-wrap"><div className="countdown" role="timer" aria-label="Cuenta regresiva para el 22 de octubre de 2026">{values.map((value, i) => <div key={i}><strong>{String(value).padStart(2, '0')}</strong><span>{['DÍAS', 'HORAS', 'MINUTOS', 'SEGUNDOS'][i]}</span></div>)}</div></div>;
}
