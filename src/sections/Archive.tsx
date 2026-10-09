import { useRef } from 'react';
import { parties } from '../data/parties';
import './Archive.css';

export default function Archive({ onConfirm }: { onConfirm: () => void }) {
  const track = useRef<HTMLDivElement>(null);

  const move = (direction: number) => {
    const element = track.current;
    const first = element?.firstElementChild as HTMLElement | null;
    if (!element || !first) return;
    const step = first.getBoundingClientRect().width + parseFloat(getComputedStyle(element).gap);
    element.scrollBy({ left: step * direction, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };

  return <section className="archive archive-redesign" id="archive" aria-labelledby="archive-title">
    <div className="archive-intro" data-reveal>
      <div>
        <p className="archive-eyebrow"><span aria-hidden="true"/>EL ARCHIVO</p>
        <h2 id="archive-title" className="archive-title"><span>FIESTA DE</span><span>DISFRACES</span></h2>
      </div>
      <div className="archive-description">
        <p>Somos estudiantes que hacemos pedas caseras, pero esta vez quisimos subir el nivel.</p>
        <p>El disfraz es opcional, pero habrá felicitación al mejor disfraz.</p>
        <button type="button" className="attendance-link" onClick={onConfirm} aria-haspopup="dialog" aria-controls="attendance-modal">Me apunto <span aria-hidden="true">↗</span></button>
      </div>
    </div>
    <div className="archive-carousel" role="region" aria-roledescription="carrusel" aria-label="Recuerdos de Pink House" data-reveal>
      <div className="archive-carousel-heading"><p className="archive-eyebrow"><span aria-hidden="true"/>RECUERDOS COMPARTIDOS</p></div>
      <div ref={track} id="archive-track" className="archive-track" tabIndex={0} aria-label="Imágenes; usa las flechas izquierda y derecha para recorrerlas"
        onKeyDown={e => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1); }
          else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); e.currentTarget.scrollTo({ left: e.key === 'Home' ? 0 : e.currentTarget.scrollWidth, behavior: 'instant' }); }
        }}>
        {parties.map((party, index) => <article className="archive-slide" key={party.id} role="group" aria-roledescription="diapositiva" aria-label={`${index + 1} de ${parties.length}: ${party.title}`}>
          <div className="archive-image"><img src={party.cover} alt={party.title} loading="lazy"/></div>
          <div className="archive-caption"><span>[{String(index + 1).padStart(2, '0')}]</span><div><h3>{party.title}</h3><p>{party.year}</p></div></div>
        </article>)}
      </div>
    </div>
  </section>;
}
