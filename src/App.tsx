import { useCallback, useEffect, useState } from "react";
import { Database, X } from "lucide-react";
import { AiAnalysisPanel } from "./components/AiAnalysisPanel";
import { DecisionCatalog } from "./components/DecisionCatalog";
import { ImpactDashboard } from "./components/ImpactDashboard";
import { PitchCarousel } from "./components/PitchCarousel";
import { PlanDock } from "./components/PlanDock";
import { TopBar } from "./components/TopBar";
import { useAnalysis } from "./hooks/useAnalysis";
import { useSimulation, type SelectionResult } from "./hooks/useSimulation";
import { buildPitchSlides } from "./lib/pitch";
import type { PitchSlideData } from "./types";

function App() {
  const simulation = useSimulation();
  const analysis = useAnalysis(simulation.key);
  const [notice, setNotice] = useState<SelectionResult | null>(null);
  const [pitchOpen, setPitchOpen] = useState(false);
  const [pitchSlides, setPitchSlides] = useState<PitchSlideData[]>([]);
  const closePitch = useCallback(() => setPitchOpen(false), []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    setPitchOpen(false);
  }, [simulation.key]);
  const analyze = () => {
    if (simulation.canAnalyze) void analysis.start(simulation.plan);
  };
  const catalog = simulation.catalog;
  return (
    <div className="app-shell">
      <TopBar selectedCount={simulation.selectedMeasures.length} />
      {!catalog ? (
        <main className="panel startup-panel">
          <h1>Загрузка симулятора</h1>
          {simulation.catalogError ? (
            <>
              <p role="alert">{simulation.catalogError}</p>
              <button
                type="button"
                className="secondary-action"
                onClick={simulation.reloadCatalog}
              >
                Повторить подключение
              </button>
            </>
          ) : (
            <p role="status">Загружаем каталог с сервера…</p>
          )}
        </main>
      ) : (
        <main className="dashboard-grid">
          <DecisionCatalog
            catalog={catalog}
            plan={simulation.plan}
            onSelect={simulation.selectMeasure}
            onAssign={simulation.assignDistrict}
            onNotice={setNotice}
            onExample={simulation.applyExamplePlan}
          />
          <div className="workspace-column">
            <PlanDock
              catalog={catalog}
              plan={simulation.plan}
              selectedMeasures={simulation.selectedMeasures}
              spent={simulation.spent}
              result={simulation.result}
              calculating={simulation.calculating}
              error={simulation.error ?? ""}
              canAnalyze={simulation.canAnalyze}
              isAnalyzing={analysis.status === "loading"}
              onRemove={(id) => setNotice(simulation.removeMeasure(id))}
              onReset={() => setNotice(simulation.reset())}
              onAnalyze={analyze}
              onRetry={simulation.retryCalculation}
            />
            {simulation.result ? (
              <ImpactDashboard
                result={simulation.result}
                labels={catalog.metric_labels}
              />
            ) : (
              <section className="panel result-placeholder">
                <h2>Карта эффекта</h2>
                <p>
                  Показатели появятся после проверки полного плана сервером.
                </p>
              </section>
            )}
          </div>
          <AiAnalysisPanel
            canAnalyze={simulation.canAnalyze}
            status={analysis.status}
            assessment={analysis.response?.assessment}
            error={analysis.error}
            isStale={analysis.isStale}
            aiAvailable={catalog.ai_available}
            onAnalyze={analyze}
            onCancel={analysis.cancel}
            onGeneratePitch={() => {
              if (analysis.response && !analysis.isStale) {
                setPitchSlides(buildPitchSlides(analysis.response));
                setPitchOpen(true);
              }
            }}
          />
        </main>
      )}
      <footer className="data-footer">
        <span>
          <Database size={14} />
          Датасет задания · расчёт на сервере
        </span>
        {catalog && (
          <span>
            {catalog.dataset.districts.length} районов ·{" "}
            {Object.keys(catalog.metric_labels).length} показателей ·{" "}
            {catalog.rules.horizon_periods} кварталов
          </span>
        )}
      </footer>
      {notice && (
        <div
          className={`toast toast-${notice.ok ? "success" : "error"}`}
          role="status"
          aria-live="polite"
        >
          <span>{notice.message}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Закрыть уведомление"
          >
            <X size={15} />
          </button>
        </div>
      )}
      <PitchCarousel
        open={pitchOpen}
        slides={pitchSlides}
        onClose={closePitch}
      />
    </div>
  );
}
export default App;
