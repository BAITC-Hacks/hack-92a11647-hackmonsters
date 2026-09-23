import { ArrowRight, Check, CircleAlert, Download, RotateCcw, Trash2 } from 'lucide-react';
import { categoryColor } from '../data';
import { downloadJson } from '../lib/simulation';
import type { Catalog, Measure, SimulationResult } from '../types';

interface Props {
  catalog: Catalog;
  selectedMeasures: Measure[];
  assignments: Record<string, string>;
  spent: number;
  result: SimulationResult | null;
  pending: boolean;
  error: string;
  isAnalyzing: boolean;
  onRemove: (id: string) => void;
  onAssign: (id: string, district: string) => void;
  onReset: () => void;
  onAnalyze: () => void;
}

export function PlanDock({ catalog, selectedMeasures, assignments, spent, result, pending, error,
  isAnalyzing, onRemove, onAssign, onReset, onAnalyze }: Props) {
  const remaining = result?.budget.remaining ?? catalog.budget_limit - spent;
  return (
    <section className="panel plan-dock" aria-labelledby="plan-title">
      <div className="plan-dock__top">
        <div><p className="eyebrow">Ваш мандат</p><div className="heading-line">
          <h2 id="plan-title">План решений</h2>
          <span className={result ? 'readiness is-ready' : 'readiness'}>{result ? <Check size={13} /> : <CircleAlert size={13} />}{selectedMeasures.length}/{catalog.required_decisions}</span>
        </div></div>
        <button type="button" className="ghost-button compact" onClick={onReset} disabled={!selectedMeasures.length}><RotateCcw size={14} />Сбросить</button>
      </div>
      <div className="decision-slots" aria-label="Пять слотов решений">
        {Array.from({ length: catalog.required_decisions }, (_, index) => {
          const measure = selectedMeasures[index];
          return (
            <div key={measure?.id ?? index} className={`decision-slot${measure ? ' is-filled' : ''}`}
              style={{ '--direction-color': measure ? categoryColor(measure.category) : '#89958f' } as React.CSSProperties}>
              <div className="decision-slot__number">{index + 1}</div>
              <div className="decision-slot__content">
                <span>{measure?.category ?? 'Свободный слот'}</span><strong>{measure ? `${measure.id} · ${measure.name}` : 'Выберите меру из каталога'}</strong>
                {measure?.measure_type === 'District' && (
                  <label className="district-selector">Район
                    <select aria-label={`Район для ${measure.id}`} value={assignments[measure.id] ?? ''} onChange={(event) => onAssign(measure.id, event.target.value)}>
                      <option value="">Выберите район</option>
                      {catalog.dataset.districts.map((district) => <option key={district.id} value={district.id}>{district.name}</option>)}
                    </select>
                  </label>
                )}
                {measure?.measure_type === 'City' && <small>Все районы · стоимость за весь город</small>}
              </div>
              {measure && <><span className="decision-slot__cost">{measure.cost}</span><button type="button" className="slot-remove" onClick={() => onRemove(measure.id)} aria-label={`Удалить ${measure.id}`}><Trash2 size={14} /></button></>}
            </div>
          );
        })}
      </div>
      <div className="budget-block">
        <div className="budget-copy"><div><span>Виртуальный бюджет</span><strong>{spent} <small>/ {catalog.budget_limit} у.е.</small></strong></div>
          <div className="budget-remaining"><span>Осталось</span><strong>{remaining} у.е.</strong></div>
        </div>
        <div className="budget-track" role="meter" aria-label="Использованный бюджет" aria-valuemin={0} aria-valuemax={catalog.budget_limit} aria-valuenow={spent}>
          <span style={{ width: `${Math.min(100, spent / catalog.budget_limit * 100)}%` }} />
        </div>
      </div>
      <p className={error ? 'validation-hint is-error' : 'validation-hint'} role={error ? 'alert' : 'status'}>
        {error || (pending ? 'Сервер проверяет ограничения и считает результат…' : result ? 'План проверен сервером. Расчёт готов.' : 'Выберите пять мер и укажите район каждой районной меры.')}
      </p>
      <button type="button" className="primary-action analyze-action" disabled={!result || isAnalyzing} onClick={onAnalyze}>
        <span>{isAnalyzing ? 'AI анализирует сценарий…' : 'Запустить AI-анализ'}</span><ArrowRight size={18} />
      </button>
      <button type="button" className="ghost-button" disabled={!result} onClick={() => result && downloadJson(result)}><Download size={15} />Скачать JSON расчёта</button>
    </section>
  );
}
