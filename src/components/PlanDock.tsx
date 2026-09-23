import { ArrowRight, RotateCcw, Trash2 } from "lucide-react";
import type { Catalog, Measure, Plan, SimulationResult } from "../types";

interface Props {
  catalog: Catalog;
  plan: Plan;
  selectedMeasures: Measure[];
  spent: number;
  result: SimulationResult | null;
  calculating: boolean;
  error: string;
  canAnalyze: boolean;
  isAnalyzing: boolean;
  onRemove: (id: string) => void;
  onReset: () => void;
  onAnalyze: () => void;
  onRetry: () => void;
}
export function PlanDock({
  catalog,
  plan,
  selectedMeasures,
  spent,
  result,
  calculating,
  error,
  canAnalyze,
  isAnalyzing,
  onRemove,
  onReset,
  onAnalyze,
  onRetry,
}: Props) {
  // Partial selection shows an advisory budget; completed plans use the server value.
  const budget = result?.budget ?? {
    spent,
    remaining: catalog.budget_limit - spent,
    limit: catalog.budget_limit,
  };
  return (
    <section className="panel plan-dock" aria-labelledby="plan-title">
      <div className="plan-dock__top">
        <div>
          <p className="eyebrow">Ваш мандат</p>
          <div className="heading-line">
            <h2 id="plan-title">План решений</h2>
            <span className={`readiness${result ? " is-ready" : ""}`}>
              {selectedMeasures.length}/{catalog.required_decisions}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="ghost-button compact"
          onClick={onReset}
          disabled={!selectedMeasures.length}
        >
          <RotateCcw size={14} />
          Сбросить
        </button>
      </div>
      <div className="decision-slots" aria-label="Слоты решений">
        {Array.from({ length: catalog.required_decisions }, (_, index) => {
          const measure = selectedMeasures[index];
          const target =
            measure &&
            catalog.dataset.districts.find(
              (d) => d.id === plan.district_assignments[measure.id],
            );
          return (
            <div
              className={`decision-slot${measure ? " is-filled" : ""}`}
              key={index}
            >
              <div className="decision-slot__number">{index + 1}</div>
              <div className="decision-slot__content">
                <span>
                  {measure
                    ? `${measure.category} · ${target?.name ?? "Весь город"}`
                    : "Свободный слот"}
                </span>
                <strong>{measure?.name ?? "Выберите меру"}</strong>
              </div>
              {measure && (
                <>
                  <span className="decision-slot__cost">{measure.cost}</span>
                  <button
                    type="button"
                    className="slot-remove"
                    aria-label={`Удалить ${measure.id}`}
                    onClick={() => onRemove(measure.id)}
                  >
                    <Trash2 size={14} />
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
            <span>
              {result ? "Бюджет проверен сервером" : "Бюджет выбранных мер"}
            </span>
            <strong>
              {budget.spent} <small>/ {budget.limit} у.е.</small>
            </strong>
          </div>
          <div className="budget-remaining">
            <span>Осталось</span>
            <strong>{budget.remaining} у.е.</strong>
          </div>
        </div>
        <div
          className="budget-track"
          role="meter"
          aria-label="Использованный бюджет"
          aria-valuemin={0}
          aria-valuemax={budget.limit}
          aria-valuenow={budget.spent}
        >
          <span style={{ width: `${(budget.spent / budget.limit) * 100}%` }} />
        </div>
      </div>
      {calculating && (
        <p className="validation-hint" role="status">
          Сервер рассчитывает показатели…
        </p>
      )}
      {error && (
        <div className="analysis-error" role="alert">
          <p>{error}</p>
          <button type="button" className="ghost-button" onClick={onRetry}>
            Повторить расчёт
          </button>
        </div>
      )}
      <button
        type="button"
        className="primary-action analyze-action"
        disabled={!canAnalyze || isAnalyzing}
        onClick={onAnalyze}
      >
        <span>
          {isAnalyzing ? "OpenAI анализирует…" : "Объяснить результат с AI"}
        </span>
        <ArrowRight size={18} />
      </button>
      {!result && !calculating && !error && (
        <p className="validation-hint">
          Нужны {catalog.required_decisions} мер с указанными районами. Не более{" "}
          {catalog.max_per_category} мер в одном направлении.
        </p>
      )}
    </section>
  );
}
