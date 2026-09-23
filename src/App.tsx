import { useCallback, useEffect, useState } from 'react';
import { Database, X } from 'lucide-react';
import { AiAnalysisPanel } from './components/AiAnalysisPanel';
import { AgentPlanner } from './components/AgentPlanner';
import { DecisionCatalog } from './components/DecisionCatalog';
import { ImpactDashboard } from './components/ImpactDashboard';
import { PitchCarousel } from './components/PitchCarousel';
import { PlanDock } from './components/PlanDock';
import { TopBar } from './components/TopBar';
import { useAnalysisStream } from './hooks/useAnalysisStream';
import { useSimulation } from './hooks/useSimulation';
import { generatePitchDeck } from './services/pitchService';
import type { AnalysisProvider, PitchSlideData } from './types';

function App() {
  const simulation = useSimulation();
  const analysis = useAnalysisStream();
  const [provider, setProvider] = useState<AnalysisProvider>('auto');
  const [notice, setNotice] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const [pitchOpen, setPitchOpen] = useState(false);
  const [agentBusy, setAgentBusy] = useState(false);
  const [pitchSlides, setPitchSlides] = useState<PitchSlideData[]>([]);
  const analysisKey = `${simulation.planKey}|${provider}`;
  const isStale = Boolean(analysis.analyzedPlanKey && analysis.analyzedPlanKey !== analysisKey);

  useEffect(() => {
    if (analysis.status === 'streaming' && isStale) analysis.cancel();
  }, [analysis.status, isStale, analysis.cancel]);
  useEffect(() => { setPitchOpen(false); }, [simulation.planKey]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const handleAnalyze = () => {
    if (simulation.canAnalyze && !agentBusy) void analysis.start(simulation.plan, provider, analysisKey);
  };
  const closePitch = useCallback(() => setPitchOpen(false), []);
  const catalog = simulation.catalog;

  return (
    <div className="app-shell">
      <TopBar selectedCount={simulation.selectedMeasures.length} />
      {!catalog ? (
        <main className="panel startup-panel" role="status">
          <h1>{simulation.catalogError ? 'Не удалось подключиться к серверу' : 'Загружаем каталог…'}</h1>
          <p>{simulation.catalogError || 'Получаем исходные показатели и правила расчёта.'}</p>
          {simulation.catalogError && <button type="button" className="secondary-action" onClick={simulation.retryCatalog}>Повторить</button>}
        </main>
      ) : (
        <main className="dashboard-grid">
          <DecisionCatalog catalog={catalog} selectedMeasures={simulation.selectedMeasures} onSelect={simulation.selectMeasure}
            onNotice={(message, tone) => setNotice({ message, tone })} onExample={simulation.applyExample} />
          <div className="workspace-column">
            <PlanDock catalog={catalog} selectedMeasures={simulation.selectedMeasures} assignments={simulation.plan.district_assignments}
              spent={simulation.spent} result={simulation.result} pending={simulation.pending} error={simulation.error}
              isAnalyzing={analysis.status === 'streaming' || agentBusy} onRemove={simulation.removeMeasure} onAssign={simulation.assignDistrict}
              onReset={simulation.reset} onAnalyze={handleAnalyze} />
            <ImpactDashboard catalog={catalog} result={simulation.result} />
            <AgentPlanner plan={simulation.plan} planKey={simulation.planKey} planValid={simulation.canAnalyze}
              provider={provider} analysisBusy={analysis.status === 'streaming'}
              onApply={simulation.applyPlan} onBusyChange={setAgentBusy} />
          </div>
          <AiAnalysisPanel canAnalyze={simulation.canAnalyze && !agentBusy} status={analysis.status} markdown={analysis.markdown}
            error={analysis.error} provider={provider} providerUsed={analysis.providerUsed} isStale={isStale} pitchLoading={false}
            onProviderChange={setProvider} onAnalyze={handleAnalyze} onCancel={analysis.cancel}
            onGeneratePitch={() => {
              if (!simulation.result) return;
              setPitchSlides(generatePitchDeck(simulation.result));
              setPitchOpen(true);
            }} />
        </main>
      )}
      <footer className="data-footer"><span><Database size={14} />Серверный каталог · без mock-ответов</span>
        <span>{catalog?.methodology.version ?? 'Загрузка методики'} · Сервер считает, AI объясняет и предлагает планы</span></footer>
      {notice && <div className={`toast toast-${notice.tone}`} role="status" aria-live="polite">
        <span>{notice.message}</span><button type="button" onClick={() => setNotice(null)} aria-label="Закрыть уведомление"><X size={15} /></button>
      </div>}
      <PitchCarousel open={pitchOpen} slides={pitchSlides} onClose={closePitch} />
    </div>
  );
}

export default App;
