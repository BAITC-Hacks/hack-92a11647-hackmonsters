import { useEffect, useMemo, useState } from 'react';
import examplePlan from '../../examples/official_request.json';
import { requestJson } from '../services/api';
import type { Catalog, Measure, SimulationRequest, SimulationResult } from '../types';

export interface SelectionResult { ok: boolean; message: string }

export function useSimulation() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [reload, setReload] = useState(0);
  const [plan, setPlan] = useState<SimulationRequest>({ measure_ids: [], district_assignments: {} });
  const [calculation, setCalculation] = useState<{ key: string; result?: SimulationResult; error?: string }>({ key: '' });
  const planKey = JSON.stringify(plan);
  const selectedMeasures = useMemo(() => plan.measure_ids.flatMap((id) => {
    const measure = catalog?.dataset.measures.find((item) => item.id === id);
    return measure ? [measure] : [];
  }), [plan, catalog]);
  const spent = selectedMeasures.reduce((total, measure) => total + measure.cost, 0);
  const ready = Boolean(catalog && selectedMeasures.length === catalog.required_decisions
    && selectedMeasures.every((measure) => measure.measure_type === 'City' || plan.district_assignments[measure.id]));
  const result = ready && calculation.key === planKey ? calculation.result ?? null : null;
  const error = ready && calculation.key === planKey ? calculation.error ?? '' : '';
  const pending = ready && !result && !error;

  useEffect(() => {
    const controller = new AbortController();
    setCatalogError('');
    requestJson<Catalog>('/api/catalog', controller.signal)
      .then((response) => { if (!controller.signal.aborted) setCatalog(response); })
      .catch((caught) => {
        if (!controller.signal.aborted) setCatalogError(caught instanceof Error ? caught.message : 'Не удалось загрузить каталог.');
      });
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setCalculation({ key: planKey });
    requestJson<SimulationResult>('/api/simulate', controller.signal, JSON.parse(planKey))
      .then((response) => {
        if (!controller.signal.aborted) setCalculation({ key: planKey, result: response });
      })
      .catch((caught) => {
        if (!controller.signal.aborted) setCalculation({
          key: planKey, error: caught instanceof Error ? caught.message : 'Не удалось рассчитать план.',
        });
      });
    return () => controller.abort();
  }, [planKey, ready]);

  const removeMeasure = (id: string) => {
    setPlan((current) => ({
      measure_ids: current.measure_ids.filter((measureId) => measureId !== id),
      district_assignments: Object.fromEntries(Object.entries(current.district_assignments).filter(([measureId]) => measureId !== id)),
    }));
  };

  const selectMeasure = (measure: Measure): SelectionResult => {
    if (plan.measure_ids.includes(measure.id)) {
      removeMeasure(measure.id);
      return { ok: true, message: 'Мера убрана из плана.' };
    }
    if (!catalog) return { ok: false, message: 'Дождитесь загрузки каталога.' };
    if (selectedMeasures.length >= catalog.required_decisions) return { ok: false, message: 'Все слоты заняты. Сначала уберите одну меру.' };
    if (spent + measure.cost > catalog.budget_limit) return { ok: false, message: 'Эта мера превышает оставшийся бюджет.' };
    if (selectedMeasures.filter((item) => item.category === measure.category).length >= catalog.max_per_category)
      return { ok: false, message: 'Можно выбрать максимум две меры из одного направления.' };
    const conflict = catalog.dataset.conflicts.find((rule) => rule.scope === 'global'
      && rule.pair.includes(measure.id) && rule.pair.some((id) => plan.measure_ids.includes(id)));
    if (conflict) return { ok: false, message: `Несовместимые меры: ${conflict.pair.join(', ')}.` };
    setPlan((current) => ({ ...current, measure_ids: [...current.measure_ids, measure.id] }));
    return { ok: true, message: measure.measure_type === 'District' ? 'Мера добавлена. Укажите её район в плане.' : 'Общегородская мера добавлена.' };
  };

  return {
    catalog, catalogError, retryCatalog: () => setReload((current) => current + 1),
    plan, planKey, selectedMeasures, spent, result, pending, error, canAnalyze: Boolean(result),
    selectMeasure, removeMeasure,
    assignDistrict: (id: string, district: string) => setPlan((current) => ({
      ...current, district_assignments: { ...current.district_assignments, [id]: district },
    })),
    reset: () => setPlan({ measure_ids: [], district_assignments: {} }),
    applyPlan: (proposal: SimulationRequest) => setPlan({
      measure_ids: [...proposal.measure_ids], district_assignments: { ...proposal.district_assignments },
    }),
    applyExample: () => setPlan({ measure_ids: [...examplePlan.measure_ids], district_assignments: { ...examplePlan.district_assignments } }),
  };
}
