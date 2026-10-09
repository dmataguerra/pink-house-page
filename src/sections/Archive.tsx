import { useEffect, useRef, useState } from 'react';
import { parties } from '../data/parties';
import './Archive.css';

export default function Archive() {
  const track = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ index: 0, previous: false, next: true });

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const update = () => {
      const max = element.scrollWidth - element.clientWidth;
      const first = element.firstElementChild as HTMLElement | null;
      const step = (first?.getBoundingClientRect().width ?? 0) + parseFloat(getComputedStyle(element).gap);
      const atEnd = max > 2 && element.scrollLeft >= max - 2;
      setPosition({ index: atEnd ? parties.length - 1 : Math.round(element.scrollLeft / Math.max(step, 1)), previous: element.scrollLeft > 2, next: element.scrollLeft < max - 2 });
    };
    update();
    element.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => { element.removeEventListener('scroll', update); observer.disconnect(); };
  }, []);

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
        <h2 id="archive-title" className="archive-title"><span className="archive-title-line"><span>FIESTA</span> <span>DE</span></span><span>DISFRACES</span></h2>
      </div>
      <p className="archive-description">El archivo.<br/>Recuerdos compartidos.</p>
    </div>
    <div className="archive-carousel" role="region" aria-roledescription="carrusel" aria-label="Recuerdos de Pink House" data-reveal>
      <div className="archive-carousel-heading"><p className="archive-eyebrow"><span aria-hidden="true"/>RECUERDOS COMPARTIDOS</p><span>{String(parties.length).padStart(2, '0')} IMÁGENES</span></div>
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
      <div className="archive-controls">
        <button type="button" onClick={() => move(-1)} disabled={!position.previous} aria-label="Imagen anterior" aria-controls="archive-track"><span aria-hidden="true">‹</span> ANTERIOR</button>
        <span className="archive-pagination" aria-hidden="true">{parties.map((party, index) => <i key={party.id} className={index === position.index ? 'is-active' : ''}/>)}</span>
        <button type="button" onClick={() => move(1)} disabled={!position.next} aria-label="Imagen siguiente" aria-controls="archive-track">SIGUIENTE <span aria-hidden="true">›</span></button>
        <span className="archive-slide-status" role="status" aria-live="polite">Imagen {position.index + 1} de {parties.length}</span>
      </div>
    </div>
  </section>;
}
