import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { event } from '../config/event';
import { parties } from '../data/parties';
import './Editorial.css';

gsap.registerPlugin(ScrollTrigger);

type EditorialProps = { onConfirm: () => void; onSchedule: () => void };

const image = (name: string) => `${import.meta.env.BASE_URL}images/${name}`;
const transitionWords = 'PINK HOUSE ARCHIVE'.split(' ');
const collageImages = [
  image('archive-knife-cinematic.webp'), image('archive-party-cinematic.webp'), image('archive-mask-cinematic.webp'),
  image('archive-party-cinematic.webp'), image('archive-drinks-documentary.webp'),
  image('archive-location-documentary.webp'), image('archive-party-cinematic.webp'), image('archive-prize-documentary.webp'),
];

function SectionLabel({ title, count }: { title: string; count: string }) {
  return <div className="editorial-label"><p>{title}<span className="editorial-label-arrow" aria-hidden="true"/></p><span className="editorial-label-count">__{count}.</span></div>;
}

export default function Editorial({ onConfirm, onSchedule }: EditorialProps) {
  const root = useRef<HTMLDivElement>(null);
  const preview = useRef<HTMLElement>(null);
  const previewBackground = useRef<HTMLDivElement>(null);
  const works = useRef<HTMLElement>(null);
  const worksStage = useRef<HTMLDivElement>(null);
  const [wordCount, setWordCount] = useState(1);
  const [activeImage, setActiveImage] = useState(0);

  useLayoutEffect(() => {
    const context = gsap.context(() => {
      const media = gsap.matchMedia();
      media.add('(prefers-reduced-motion: no-preference)', () => {
        if (!preview.current || !previewBackground.current || !works.current || !worksStage.current) return;
        ScrollTrigger.create({
          trigger: preview.current,
          start: 'top top',
          end: 'bottom bottom',
          onUpdate: trigger => {
            const progress = trigger.progress;
            previewBackground.current?.style.setProperty('--preview-progress', String(progress));
            previewBackground.current?.style.setProperty('--preview-expand', String(1 + Math.max(0, (progress - .85) / .15) * .1));
            const entry = Math.max(0, Math.min(1, (works.current?.getBoundingClientRect().top ?? 0) / window.innerHeight));
            worksStage.current?.style.setProperty('--archive-entry', String(entry));
            setWordCount(window.innerWidth <= 1024 ? transitionWords.length : Math.min(transitionWords.length, 1 + Math.floor(progress / .82 * (transitionWords.length - 1))));
          },
        });
        ScrollTrigger.create({
          trigger: works.current,
          start: 'top top',
          end: 'bottom bottom',
          onUpdate: trigger => {
            const progress = trigger.progress;
            const zoom = Math.min(1, progress * 5.5);
            worksStage.current?.style.setProperty('--archive-zoom', String(zoom));
            works.current?.style.setProperty('--archive-metadata', String(Math.max(0, Math.min(1, (progress - .185) / .04))));
            works.current?.style.setProperty('--archive-visibility', progress > .185 ? 'visible' : 'hidden');
            worksStage.current?.style.setProperty('--archive-entry', '0');
            setActiveImage(Math.min(parties.length - 1, Math.floor(Math.max(0, progress - .2) / .8 * parties.length)));
          },
        });
      });
      media.add('(prefers-reduced-motion: reduce)', () => {
        setWordCount(transitionWords.length);
        previewBackground.current?.style.setProperty('--preview-progress', '1');
        worksStage.current?.style.setProperty('--archive-zoom', '1');
        works.current?.style.setProperty('--archive-metadata', '1');
        works.current?.style.setProperty('--archive-visibility', 'visible');
      });
      return () => media.revert();
    }, root);
    return () => context.revert();
  }, []);

  const selectArchive = (index: number) => {
    const section = works.current;
    if (!section) return;
    setActiveImage(index);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = section.getBoundingClientRect().top + window.scrollY;
    const range = section.offsetHeight - window.innerHeight;
    window.scrollTo({ top: start + range * (.24 + index * .3), behavior: reducedMotion ? 'instant' : 'smooth' });
  };

  const highlights = [
    { letter: 'A', title: <>22 de octubre.<br/>Desde las<br/>20:00.</>, mobileTitle: '22 de octubre. Desde las 20:00.', src: image('archive-house-cinematic.webp'), action: onSchedule, label: 'Ver los detalles de la noche' },
    { letter: 'B', title: <>Disfraz<br/>recomendado.</>, mobileTitle: 'Ven con disfraz.', src: image('archive-mask-cinematic.webp'), action: onConfirm, label: 'Disfraz recomendado, no obligatorio. Confirmar asistencia' },
    { letter: 'C', title: <>Concurso<br/>y premio<br/>al mejor.</>, mobileTitle: 'Concurso y premio al mejor disfraz.', src: image('archive-prize-documentary.webp'), action: onSchedule, label: 'Concurso y premio al mejor disfraz. Ver las actividades de Halloween' },
    { letter: 'D', title: <>La ubicación<br/>al confirmar<br/>asistencia.</>, mobileTitle: 'Ubicación al confirmar.', src: image('archive-location-documentary.webp'), action: onConfirm, label: 'Confirmar asistencia y consultar la ubicación' },
  ];

  return <div className="editorial" ref={root}>
    <section className="mobile-event-summary" aria-label="Tu noche en The Pink House">
      <p className="mobile-event-summary-label">HALLOWEEN / 22.10.2026</p>
      <h2>Tu noche<br/>en la casa.</h2>
      <dl><div><dt>Cuándo</dt><dd>22 de octubre · 20:00</dd></div><div><dt>Disfraz</dt><dd>Recomendado, no obligatorio.<br/>Premio al mejor de la noche.</dd></div><div><dt>Dónde</dt><dd>Ubicación al confirmar.</dd></div></dl>
      <button type="button" className="mobile-rsvp-action" onClick={onConfirm} aria-haspopup="dialog" aria-controls="attendance-modal">Confirmar asistencia <span aria-hidden="true">↗</span></button>
    </section>
    <section className="editorial-identity editorial-fullscreen" id="archive" aria-labelledby="identity-title">
      <SectionLabel title="La casa" count="001"/>
      <div className="editorial-centered editorial-identity-content">
        <h2 className="editorial-statement" id="identity-title">Estudiantes que hacen pedas caseras; sin embargo,<br className="editorial-tablet-break"/> este año quisimos subir el nivel. <strong>Halloween en The Pink House. La casa de siempre. Una noche diferente.</strong></h2>
        <p className="editorial-note editorial-identity-note">Ven a descubrirlo. La casa de siempre, una noche diferente.</p>
      </div>
    </section>

    <section className="editorial-support" id="night" aria-label="Los detalles de la noche">
      <div className="editorial-divider"/>
      <SectionLabel title="Una noche diferente" count="002"/>
      <div className="editorial-support-items">
        {highlights.map(highlight => <article className="editorial-support-item" key={highlight.letter}>
          <button type="button" className="editorial-support-button" onClick={highlight.action} aria-label={highlight.label} aria-haspopup="dialog">
            <span className="editorial-support-letter" aria-hidden="true">{highlight.letter}</span>
            <span className="editorial-support-title"><span className="editorial-support-desktop" aria-hidden="true">{highlight.title}</span><span className="editorial-support-mobile" aria-hidden="true">{highlight.mobileTitle}</span></span>
            <span className="editorial-support-image"><img src={highlight.src} alt="" loading="lazy"/></span>
          </button>
        </article>)}
      </div>
    </section>

    <section className="editorial-preview" ref={preview} aria-labelledby="archive-intro-title">
      <div className="editorial-preview-sticky editorial-fullscreen">
        <div className="editorial-preview-background" ref={previewBackground} aria-hidden="true"/>
        <div className="editorial-centered editorial-preview-content">
          <h2 className="editorial-statement" id="archive-intro-title" aria-label={transitionWords.join(' ')}>
            {transitionWords.map((word, index) => <span className={index >= wordCount ? 'archive-word-pending' : undefined} key={`${word}-${index}`}>{index > 0 && ' '}{word}</span>)}
          </h2>
        </div>
      </div>
    </section>

    <section className="editorial-works" id="archive-gallery" ref={works} aria-label="Pink House Archive">
      <div className="editorial-works-sticky">
        <SectionLabel title="Pink House Archive" count="003"/>
        <div className="editorial-works-stage" ref={worksStage}>
          <div className="editorial-collage" aria-hidden="true">
            {collageImages.map((src, index) => <div className={`editorial-collage-tile editorial-collage-tile-${index + 1}`} key={`${src}-${index}`}><img src={src} alt="" loading="lazy"/></div>)}
          </div>
          <div className="editorial-featured-image">
            {parties.map((party, index) => <img src={party.cover} alt={party.title} key={party.id} className={index === activeImage ? 'is-active' : ''} loading="lazy" aria-hidden={index !== activeImage}/>)}
          </div>
        </div>
        <h2 className="editorial-works-title">{parties[activeImage].title}</h2>
        <div className="editorial-works-info">
          <p>{parties[activeImage].description || <>Estudiantes que hacen pedas caseras.<br/>Este año quisimos subir el nivel.<br/>Ven a descubrirlo.</>}</p>
          <span className="editorial-works-date">22.10.2026</span>
          <div className="editorial-works-pagination" role="group" aria-label="Recorrer el archivo">
            {parties.map((party, index) => <button type="button" key={party.id} onClick={() => selectArchive(index)} className={index === activeImage ? 'is-active' : ''} aria-label={`Ver ${party.title}`} aria-pressed={index === activeImage}/>) }
          </div>
          <button type="button" className="editorial-outline-action" onClick={onConfirm} aria-haspopup="dialog" aria-controls="attendance-modal">Tu entrada</button>
        </div>
      </div>
    </section>

    <section className="editorial-rsvp editorial-fullscreen" id="rsvp" aria-labelledby="editorial-rsvp-title">
      <SectionLabel title="Tu entrada" count="004"/>
      <div className="editorial-centered editorial-rsvp-content">
        <h2 className="editorial-statement" id="editorial-rsvp-title">Lo que pasa en la Pink House <strong>se queda en la Pink House.</strong></h2>
        <div className="editorial-note editorial-rsvp-note">
          <p><time dateTime={event.eventDate}>22 de octubre de 2026</time><br/>Desde las 20:00.<br/>Disfraz recomendado, no obligatorio.</p>
          <button type="button" className="editorial-text-action" onClick={onConfirm} aria-label="Confirmar asistencia" aria-haspopup="dialog" aria-controls="attendance-modal">Confirmar asistencia <span aria-hidden="true">↗</span></button>
          <button type="button" className="editorial-text-action" onClick={onSchedule} aria-controls="prize-modal" aria-haspopup="dialog">Ver el plan de la noche <span aria-hidden="true">↗</span></button>
        </div>
      </div>
    </section>
  </div>;
}
