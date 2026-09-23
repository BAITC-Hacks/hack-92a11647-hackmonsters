import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clipboard,
  Maximize2,
  MessageSquareText,
  X,
} from 'lucide-react';
import type { PitchSlideData } from '../types';

interface PitchCarouselProps {
  open: boolean;
  slides: PitchSlideData[];
  onClose: () => void;
}

export function PitchCarousel({ open, slides, onClose }: PitchCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<number | null>(null);

  const goTo = (index: number) => {
    if (!slides.length) return;
    setActiveIndex((index + slides.length) % slides.length);
    setNotesOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    dialogRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') setActiveIndex((current) => Math.max(0, current - 1));
      if (event.key === 'ArrowRight')
        setActiveIndex((current) => Math.min(slides.length - 1, current + 1));
      if (event.key === 'Home') setActiveIndex(0);
      if (event.key === 'End') setActiveIndex(slides.length - 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose, slides.length]);

  if (!open || !slides.length) return null;
  const slide = slides[activeIndex];

  const copySlide = async () => {
    const text = [
      slide.title,
      ...slide.bullets.map((item) => `• ${item}`),
      `Заметки: ${slide.speakerNotes}`,
    ].join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="pitch-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div
        className="pitch-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pitch-dialog-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="pitch-dialog__header">
          <div>
            <p className="eyebrow">AI pitch deck</p>
            <h2 id="pitch-dialog-title">Защита решения команды</h2>
          </div>
          <div className="pitch-dialog__actions">
            <button className="icon-button labeled" type="button" onClick={copySlide}>
              {copied ? <Check size={15} /> : <Clipboard size={15} />}
              {copied ? 'Готово' : 'Слайд'}
            </button>
            <button
              className="icon-button labeled"
              type="button"
              onClick={() => window.print()}
            >
              <Maximize2 size={15} /> Печать
            </button>
            <button className="icon-button" type="button" onClick={onClose} aria-label="Закрыть питч">
              <X size={18} />
            </button>
          </div>
        </div>

        <div
          className="pitch-carousel"
          role="region"
          aria-roledescription="carousel"
          aria-label="Слайды питча"
          onPointerDown={(event) => {
            pointerStart.current = event.clientX;
          }}
          onPointerUp={(event) => {
            if (pointerStart.current === null) return;
            const distance = event.clientX - pointerStart.current;
            if (distance > 60) goTo(activeIndex - 1);
            if (distance < -60) goTo(activeIndex + 1);
            pointerStart.current = null;
          }}
        >
          <article
            className={`pitch-slide tone-${slide.tone}`}
            aria-roledescription="slide"
            aria-label={`Слайд ${activeIndex + 1} из ${slides.length}`}
          >
            <div className="pitch-slide__topline">
              <span>{slide.eyebrow}</span>
              <span>Астана · сценарий 01</span>
            </div>
            <div className="pitch-slide__content">
              <div className="pitch-slide__copy">
                <h3 aria-live="polite">{slide.title}</h3>
                <ul>
                  {slide.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              </div>
              {slide.metrics && (
                <div className="pitch-metrics">
                  {slide.metrics.map((metric) => (
                    <div key={metric.label}>
                      <span>{metric.label}</span>
                      <strong>{metric.value}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="pitch-slide__footer">
              <span>Әкім · 5 сағат</span>
              <strong>{String(activeIndex + 1).padStart(2, '0')}</strong>
            </div>
          </article>

          <button
            type="button"
            className="carousel-arrow carousel-arrow--prev"
            onClick={() => goTo(activeIndex - 1)}
            disabled={activeIndex === 0}
            aria-label="Предыдущий слайд"
          >
            <ArrowLeft size={19} />
          </button>
          <button
            type="button"
            className="carousel-arrow carousel-arrow--next"
            onClick={() => goTo(activeIndex + 1)}
            disabled={activeIndex === slides.length - 1}
            aria-label="Следующий слайд"
          >
            <ArrowRight size={19} />
          </button>
        </div>

        <div className="pitch-navigation">
          <button
            type="button"
            className={notesOpen ? 'notes-toggle is-open' : 'notes-toggle'}
            onClick={() => setNotesOpen((current) => !current)}
            aria-expanded={notesOpen}
          >
            <MessageSquareText size={16} /> Заметки спикера
          </button>
          <div className="slide-dots" aria-label="Выбор слайда">
            {slides.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={index === activeIndex ? 'is-active' : ''}
                onClick={() => goTo(index)}
                aria-label={`Слайд ${index + 1}: ${item.title}`}
                aria-current={index === activeIndex ? 'true' : undefined}
              />
            ))}
          </div>
          <span className="slide-counter">
            {activeIndex + 1} / {slides.length}
          </span>
        </div>
        {notesOpen && <p className="speaker-notes">{slide.speakerNotes}</p>}
      </div>
    </div>
  );
}
