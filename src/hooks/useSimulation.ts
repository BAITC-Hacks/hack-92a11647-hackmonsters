import { useMemo, useState } from 'react';
import {
  BUDGET_LIMIT,
  DIRECTIONS,
  MEASURES,
  REQUIRED_DECISIONS,
} from '../data';
import { calculateProjections, getCityScores } from '../lib/simulation';
import type { Measure } from '../types';

export type SelectionResult = {
  ok: boolean;
  message: string;
};

const INITIAL_SELECTION = [
  'adaptive-lights',
  'green-belt',
  'mobile-clinics',
];

export function useSimulation() {
  const [selectedIds, setSelectedIds] = useState<string[]>(INITIAL_SELECTION);

  const selectedMeasures = useMemo(
    () =>
      selectedIds
        .map((id) => MEASURES.find((measure) => measure.id === id))
        .filter((measure): measure is Measure => Boolean(measure)),
    [selectedIds],
  );

  const spent = selectedMeasures.reduce((sum, measure) => sum + measure.cost, 0);
  const remaining = BUDGET_LIMIT - spent;
  const coveredDirections = new Set(
    selectedMeasures.map((measure) => measure.direction),
  );
  const projections = useMemo(
    () => calculateProjections(selectedMeasures),
    [selectedMeasures],
  );
  const cityScores = useMemo(() => getCityScores(projections), [projections]);

  const canAnalyze =
    selectedMeasures.length === REQUIRED_DECISIONS &&
    spent <= BUDGET_LIMIT &&
    DIRECTIONS.every((direction) => coveredDirections.has(direction.id));

  const selectMeasure = (measure: Measure): SelectionResult => {
    if (selectedIds.includes(measure.id)) {
      setSelectedIds((current) => current.filter((id) => id !== measure.id));
      return { ok: true, message: `«${measure.title}» удалено из плана.` };
    }

    const sameDirection = selectedMeasures.find(
      (item) => item.direction === measure.direction,
    );
    const nextSpent = spent - (sameDirection?.cost ?? 0) + measure.cost;

    if (nextSpent > BUDGET_LIMIT) {
      return {
        ok: false,
        message: `Не хватает ${nextSpent - BUDGET_LIMIT} у.е. Сначала замените более дорогую меру.`,
      };
    }

    if (!sameDirection && selectedMeasures.length >= REQUIRED_DECISIONS) {
      return {
        ok: false,
        message: 'Все 5 слотов заняты. Удалите или замените одно решение.',
      };
    }

    setSelectedIds((current) => {
      if (!sameDirection) return [...current, measure.id];
      return current.map((id) => (id === sameDirection.id ? measure.id : id));
    });

    return {
      ok: true,
      message: sameDirection
        ? `«${sameDirection.title}» заменено на «${measure.title}».`
        : `«${measure.title}» добавлено. Выбрано ${selectedMeasures.length + 1} из 5.`,
    };
  };

  const removeMeasure = (id: string) => {
    const measure = selectedMeasures.find((item) => item.id === id);
    setSelectedIds((current) => current.filter((item) => item !== id));
    return measure ? `«${measure.title}» удалено из плана.` : '';
  };

  const applyBalancedPlan = () => {
    setSelectedIds([
      'adaptive-lights',
      'smart-irrigation',
      'mobile-clinics',
      'rapid-response',
      'utility-twin',
    ]);
  };

  const reset = () => setSelectedIds([]);

  return {
    selectedIds,
    selectedMeasures,
    spent,
    remaining,
    coveredDirections,
    projections,
    cityScores,
    canAnalyze,
    selectMeasure,
    removeMeasure,
    applyBalancedPlan,
    reset,
  };
}
