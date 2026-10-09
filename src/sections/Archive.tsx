import { useRef } from 'react';
import { parties } from '../data/parties';
import './Archive.css';

export default function Archive() {
  const track = useRef<HTMLDivElement>(null);

  const move = (direction: number) => {
    const element = track.current;
    const first = element?.firstElementChild as HTMLElement | null;
    if (!element || !first) return;
    const step = first.getBoundingClientRect().width + parseFloat(getComputedStyle(element).gap);
    element.scrollBy({ left: step * direction, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };

  return <section className="archive section wrapper" id="archive" aria-labelledby="archive-title">
    <div className="section-heading" data-reveal>
      <div>
        <p className="section-eyebrow">01 / Pink House</p>
        <h2 className="section-title" id="archive-title">Pink House<br/>Archive</h2>
      </div>
      <div className="section-description">
        <p>Estudiantes que hacen pedas caseras; sin embargo, este año quisimos subir el nivel. Ven a descubrirlo.</p>
        <p>Recomendado venir con disfraz (no obligatorio). Habrá concurso y premio al mejor de la noche.</p>
      </div>
    </div>
    <div className="archive-carousel" role="region" aria-roledescription="carrusel" aria-label="Archivo visual de Pink House" data-reveal>
      <div className="archive-carousel-heading">
        <p className="section-eyebrow">Archivo visual</p>
        <span className="archive-swipe-hint" aria-hidden="true">Desliza para explorar →</span>
      </div>
      <div ref={track} id="archive-track" className="archive-track" tabIndex={0} aria-label="Imágenes; usa las flechas izquierda y derecha para recorrerlas"
        onKeyDown={e => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1); }
          else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); e.currentTarget.scrollTo({ left: e.key === 'Home' ? 0 : e.currentTarget.scrollWidth, behavior: 'instant' }); }
        }}>
        {parties.map((party, index) => <article className="archive-slide" key={party.id} role="group" aria-roledescription="diapositiva" aria-label={`${index + 1} de ${parties.length}: ${party.title}`}>
          <div className="archive-image"><img src={party.cover} alt={party.title} loading="lazy"/></div>
          <div className="archive-caption"><h3>{party.title}</h3><span>{party.year}</span></div>
        </article>)}
      </div>
    </div>
  </section>;
}
