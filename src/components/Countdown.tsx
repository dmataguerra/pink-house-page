import { useEffect, useState } from 'react';
import { countdownValues, remainingSeconds } from '../lib/countdown';
import './Countdown.css';

function Digit({ value }: { value: string }) {
  const [display, setDisplay] = useState({ current: value, previous: value, moving: false });

  useEffect(() => {
    setDisplay(previous => previous.current === value ? previous : {
      current: value, previous: previous.current, moving: true,
    });
    const timer = window.setTimeout(() => setDisplay(previous => ({ ...previous, moving: false })), 560);
    return () => window.clearTimeout(timer);
  }, [value]);

  return <span className="countdown-digit" aria-hidden="true">
    {display.moving && <span key={`out-${display.current}`} className="countdown-digit-out">{display.previous}</span>}
    <span key={display.current} className={display.moving ? 'countdown-digit-in' : 'countdown-digit-current'}>{display.current}</span>
  </span>;
}

export default function Countdown({ hoursOnly = false }: { hoursOnly?: boolean }) {
  const [seconds, setSeconds] = useState(() => remainingSeconds());

  useEffect(() => {
    let timer: number;
    const update = () => {
      window.clearTimeout(timer);
      setSeconds(remainingSeconds());
      // Align to the wall clock and refresh after returning to the tab.
      timer = window.setTimeout(update, 1000 - Date.now() % 1000 + 16);
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  const values = countdownValues(seconds, hoursOnly);
  const labels = hoursOnly ? ['HORAS', 'MINUTOS', 'SEGUNDOS'] : ['DÍAS', 'HORAS', 'MINUTOS', 'SEGUNDOS'];
  const compactLabels = hoursOnly ? ['HRS', 'MIN', 'SEG'] : ['DÍAS', 'HRS', 'MIN', 'SEG'];
  return <div className="countdown-wrap"><div className="countdown" role="timer" aria-label="Cuenta regresiva para el 22 de octubre de 2026 a las 20:00">
    {values.map((value, i) => {
      const formatted = String(value).padStart(2, '0');
      return <div key={i}><strong><span className="countdown-value-accessible">{formatted}</span>{[...formatted].map((digit, index) => <Digit key={index} value={digit}/>)}</strong><span className="countdown-label"><span className="countdown-label-full">{labels[i]}</span><span className="countdown-label-compact" aria-hidden="true">{compactLabels[i]}</span></span></div>;
    })}
  </div></div>;
}
