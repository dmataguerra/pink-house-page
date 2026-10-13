import { useRef } from 'react';
import './AfterDarkFAQ.css';

type AfterDarkFAQProps = {
  onConfirm: () => void;
  onSchedule: () => void;
};

const previousParties = [
  { title: 'EL 30', description: 'La fiesta que nos junto y nos hizo lo que ahora somos', image: 'fiestas-el-30.webp', alt: 'Amigos reunidos en la casa durante El 30, en rojo y negro con grano de película' },
  { title: 'TRIO FEST', description: 'Porque aqui tambíen festejamos a los nuestros', image: 'fiestas-trio-fest.webp', alt: 'Amigos alrededor de la mesa de beer pong durante Trio Fest, en blanco y negro' },
  { title: 'HALLOWEEN 2025', description: 'Tuvo que aprender a caminar para que HALLOWEEN 26 pudiera correr', image: 'fiestas-halloween-2025.webp', alt: 'Tres amigos frente al espejo decorado para Halloween 2025, en rojo y negro' },
];

export default function AfterDarkFAQ(_props: AfterDarkFAQProps) {
  const rail = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; startX: number; startScroll: number } | null>(null);
  const move = (direction: number) => {
    const element = rail.current;
    const card = element?.firstElementChild as HTMLElement | null;
    if (!element || !card) return;
    element.scrollBy({ left: direction * (card.getBoundingClientRect().width + 20), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };

  return <section className="ad-past-parties" id="archive" aria-labelledby="ad-archive-title">
    <h2 id="ad-archive-title" className="ad-past-title">FIESTAS PASADAS</h2>
    <div ref={rail} className="ad-past-gallery" role="region" aria-roledescription="carrusel" aria-label="Fiestas pasadas; desliza o usa las flechas para recorrer las fotos" tabIndex={0} data-reveal
      onPointerDown={event => {
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        drag.current = { id: event.pointerId, startX: event.clientX, startScroll: event.currentTarget.scrollLeft };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.currentTarget.classList.add('is-dragging');
      }}
      onPointerMove={event => {
        const gesture = drag.current;
        if (!gesture || gesture.id !== event.pointerId) return;
        event.currentTarget.scrollLeft = gesture.startScroll - (event.clientX - gesture.startX);
      }}
      onPointerUp={event => {
        if (drag.current?.id !== event.pointerId) return;
        drag.current = null;
        event.currentTarget.classList.remove('is-dragging');
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { drag.current = null; rail.current?.classList.remove('is-dragging'); }}
      onLostPointerCapture={() => { drag.current = null; rail.current?.classList.remove('is-dragging'); }}
      onKeyDown={event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1); }
        else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); event.currentTarget.scrollTo({ left: event.key === 'Home' ? 0 : event.currentTarget.scrollWidth, behavior: 'instant' }); }
      }}>
      {previousParties.map((party, index) => <article className="ad-past-card" key={party.title} role="group" aria-roledescription="diapositiva" aria-label={`${index + 1} de 3: ${party.title}`}>
        <img className="ad-past-photo" src={`${import.meta.env.BASE_URL}images/${party.image}`} alt={party.alt} width="1254" height="1254" loading="lazy" decoding="async" draggable="false" />
        <div className="ad-past-caption">
          <h3>{party.title}</h3>
          <p>"{party.description}"</p>
        </div>
      </article>)}
    </div>
  </section>;
}
