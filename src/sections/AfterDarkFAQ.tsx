import { useState } from 'react';
import './AfterDarkFAQ.css';

type AfterDarkFAQProps = {
  onConfirm: () => void;
  onSchedule: () => void;
};

const previousParties = Array.from({ length: 5 }, (_, index) => String(index + 1).padStart(2, '0'));

function PreviousParty({ number }: { number: string }) {
  const [open, setOpen] = useState(false);
  const id = `ad-archive-peda-${number}`;

  return <div className={`ad-faq-group${open ? ' is-open' : ''}`}>
    <h3 className="ad-faq-heading">
      <button
        id={`${id}-button`}
        className="ad-faq-toggle"
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen(value => !value)}
      >
        <span>PEDA {number}</span>
        <span className="ad-faq-arrow" aria-hidden="true">↓</span>
      </button>
    </h3>
    <div id={`${id}-panel`} className="ad-faq-panel" aria-labelledby={`${id}-button`} hidden={!open}>
      <p>Nombre y recuerdos próximamente.</p>
    </div>
  </div>;
}

export default function AfterDarkFAQ(_props: AfterDarkFAQProps) {
  return <section className="ad-faq-section" id="archive" aria-labelledby="ad-archive-title">
    <h2 id="ad-archive-title" className="ad-faq-title">Pedas anteriores</h2>
    <div className="ad-faq-groups">
      {previousParties.map(number => <PreviousParty key={number} number={number}/>)}
    </div>
  </section>;
}
