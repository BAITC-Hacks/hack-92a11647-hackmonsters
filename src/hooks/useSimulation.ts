import { useEffect, useRef, useState } from "react";
import { planKey, selectionError } from "../lib/simulation";
import { requestJson } from "../services/api";
import type { Catalog, Measure, Plan, SimulationResult } from "../types";

const emptyPlan = (): Plan => ({ measure_ids: [], district_assignments: {} });
export interface SelectionResult {
  ok: boolean;
  message: string;
}

export function useSimulation() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [reload, setReload] = useState(0);
  const [plan, setPlan] = useState<Plan>(emptyPlan);
  const planRef = useRef(plan);
  const [completed, setCompleted] = useState<{
    key: string;
    result: SimulationResult;
  } | null>(null);
  const [failed, setFailed] = useState<{ key: string; error: string } | null>(
    null,
  );
  const [retry, setRetry] = useState(0);
  const key = planKey(plan);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogError("");
    requestJson<Catalog>("/api/catalog", controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setCatalog(value);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setCatalogError(error.message);
      });
    return () => controller.abort();
  }, [reload]);

  const localError = catalog ? selectionError(plan, catalog) : null;
  const ready = Boolean(
    catalog &&
      plan.measure_ids.length === catalog.required_decisions &&
      !localError,
  );
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setCompleted(null);
    setFailed(null);
    const timer = window.setTimeout(() => {
      requestJson<SimulationResult>("/api/simulate", controller.signal, plan)
        .then((result) => {
          if (!controller.signal.aborted) setCompleted({ key, result });
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setFailed({ key, error: error.message });
        });
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [plan, key, ready, retry]);

  const updatePlan = (next: Plan): SelectionResult => {
    if (!catalog) return { ok: false, message: "Каталог ещё не загружен." };
    const error = selectionError(next, catalog);
    if (error) return { ok: false, message: error };
    planRef.current = next;
    setPlan(next);
    return { ok: true, message: "План обновлён." };
  };
  const removeMeasure = (id: string) => {
    const current = planRef.current;
    const assignments = { ...current.district_assignments };
    delete assignments[id];
    return updatePlan({
      measure_ids: current.measure_ids.filter((item) => item !== id),
      district_assignments: assignments,
    });
  };
  const selectMeasure = (measure: Measure, district?: string) => {
    const current = planRef.current;
    if (current.measure_ids.includes(measure.id))
      return removeMeasure(measure.id);
    return updatePlan({
      measure_ids: [...current.measure_ids, measure.id],
      district_assignments: {
        ...current.district_assignments,
        ...(measure.measure_type === "District"
          ? { [measure.id]: district ?? "" }
          : {}),
      },
    });
  };
  const assignDistrict = (id: string, district: string) =>
    updatePlan({
      ...planRef.current,
      district_assignments: {
        ...planRef.current.district_assignments,
        [id]: district,
      },
    });
  const result = completed?.key === key && ready ? completed.result : null;
  const error = localError || (failed?.key === key ? failed.error : "");
  const selectedMeasures = plan.measure_ids.flatMap(
    (id) => catalog?.dataset.measures.filter((m) => m.id === id) ?? [],
  );
  return {
    catalog,
    catalogError,
    reloadCatalog: () => setReload((v) => v + 1),
    plan,
    key,
    selectedMeasures,
    spent: selectedMeasures.reduce((sum, m) => sum + m.cost, 0),
    result,
    error,
    calculating: ready && !result && !error,
    canAnalyze: Boolean(result),
    selectMeasure,
    removeMeasure,
    assignDistrict,
    retryCalculation: () => {
      setFailed(null);
      setRetry((v) => v + 1);
    },
    reset: () => updatePlan(emptyPlan()),
    applyExamplePlan: () =>
      catalog
        ? updatePlan(structuredClone(catalog.example_plan))
        : { ok: false, message: "Каталог ещё не загружен." },
  };
}
