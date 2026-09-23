import {
  ArrowRight,
  Check,
  CircleAlert,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { BUDGET_LIMIT, DIRECTIONS, REQUIRED_DECISIONS } from '../data';
import type { Measure } from '../types';

interface PlanDockProps {
  selectedMeasures: Measure[];
  spent: number;
  canAnalyze: boolean;
  isAnalyzing: boolean;
  isStale: boolean;
  onRemove: (id: string) => void;
  onReset: () => void;
  onAnalyze: () => void;
}

export function PlanDock({
  selectedMeasures,
  spent,
  canAnalyze,
  isAnalyzing,
  isStale,
  onRemove,
  onReset,
  onAnalyze,
}: PlanDockProps) {
  const percent = Math.min((spent / BUDGET_LIMIT) * 100, 100);
  const remaining = BUDGET_LIMIT - spent;

  return (
    <section className="panel plan-dock" aria-labelledby="plan-title">
      <div className="plan-dock__top">
        <div>
          <p className="eyebrow">Ваш мандат</p>
          <div className="heading-line">
            <h2 id="plan-title">План решений</h2>
            <span className={canAnalyze ? 'readiness is-ready' : 'readiness'}>
              {canAnalyze ? <Check size={13} /> : <CircleAlert size={13} />}
              {selectedMeasures.length}/{REQUIRED_DECISIONS}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="ghost-button compact"
          onClick={onReset}
          disabled={!selectedMeasures.length}
        >
          <RotateCcw size={14} aria-hidden="true" /> Сбросить
        </button>
      </div>

      <div className="decision-slots" aria-label="Пять слотов решений">
        {DIRECTIONS.map((direction, index) => {
          const measure = selectedMeasures.find(
            (item) => item.direction === direction.id,
          );
          return (
            <div
              key={direction.id}
              className={`decision-slot${measure ? ' is-filled' : ''}`}
              style={{ '--direction-color': direction.color } as React.CSSProperties}
            >
              <div className="decision-slot__number">
                {measure ? <Check size={13} aria-hidden="true" /> : index + 1}
              </div>
              <div className="decision-slot__content">
                <span>{direction.label}</span>
                <strong>{measure?.title ?? 'Решение не выбрано'}</strong>
              </div>
              {measure && (
                <>
                  <span className="decision-slot__cost">{measure.cost}</span>
                  <button
                    type="button"
                    className="slot-remove"
                    onClick={() => onRemove(measure.id)}
                    aria-label={`Удалить ${measure.title}`}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className="budget-block">
        <div className="budget-copy">
          <div>
            <span>Виртуальный бюджет</span>
            <strong>
              {spent} <small>/ {BUDGET_LIMIT} у.е.</small>
            </strong>
          </div>
          <div className={remaining < 15 ? 'budget-remaining is-warning' : 'budget-remaining'}>
            <span>Осталось</span>
            <strong>{remaining} у.е.</strong>
          </div>
        </div>
        <div
          className="budget-track"
          role="meter"
          aria-label="Использованный бюджет"
          aria-valuemin={0}
          aria-valuemax={BUDGET_LIMIT}
          aria-valuenow={spent}
        >
          <span style={{ width: `${percent}%` }} />
          <i style={{ left: '80%' }} aria-hidden="true" />
        </div>
        <div className="budget-scale" aria-hidden="true">
          <span>0</span>
          <span>порог внимания 80</span>
          <span>100</span>
        </div>
      </div>

      <button
        type="button"
        className="primary-action analyze-action"
        disabled={!canAnalyze || isAnalyzing}
        onClick={onAnalyze}
      >
        <span>
          {isAnalyzing
            ? 'AI анализирует сценарий…'
            : isStale
              ? 'Пересчитать AI-анализ'
              : 'Запустить AI-анализ'}
        </span>
        <ArrowRight size={18} aria-hidden="true" />
      </button>
      {!canAnalyze && (
        <p className="validation-hint">
          Заполните все 5 направлений. Перерасход заблокирован автоматически.
        </p>
      )}
    </section>
  );
}
