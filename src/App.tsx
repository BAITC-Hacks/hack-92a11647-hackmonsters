import { useCallback, useEffect, useMemo, useState } from 'react';
import { Database, X } from 'lucide-react';
import { AiAnalysisPanel } from './components/AiAnalysisPanel';
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
  const [provider, setProvider] = useState<AnalysisProvider>('consensus');
  const [notice, setNotice] = useState<{
    message: string;
    tone: 'success' | 'error';
  } | null>(null);
  const [pitchOpen, setPitchOpen] = useState(false);
  const [pitchLoading, setPitchLoading] = useState(false);
  const [pitchSlides, setPitchSlides] = useState<PitchSlideData[]>([]);

  const planKey = useMemo(
    () => [...simulation.selectedIds].sort().join('|'),
    [simulation.selectedIds],
  );
  const isStale = Boolean(
    analysis.analyzedPlanKey && analysis.analyzedPlanKey !== planKey,
  );

  useEffect(() => {
    if (analysis.status === 'streaming' && isStale) analysis.cancel();
  }, [analysis.status, isStale, analysis.cancel]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const handleAnalyze = () => {
    if (!simulation.canAnalyze) return;
    void analysis.start({
      selectedMeasures: simulation.selectedMeasures,
      projections: simulation.projections,
      spent: simulation.spent,
      provider,
      planKey,
    });
  };

  const handleGeneratePitch = async () => {
    if (analysis.status !== 'complete' || isStale) return;
    setPitchLoading(true);
    try {
      const slides = await generatePitchDeck({
        selectedMeasures: simulation.selectedMeasures,
        projections: simulation.projections,
        spent: simulation.spent,
        analysisMarkdown: analysis.markdown,
      });
      setPitchSlides(slides);
      setPitchOpen(true);
    } catch (caught) {
      setNotice({
        message:
          caught instanceof Error ? caught.message : 'Не удалось сгенерировать питч.',
        tone: 'error',
      });
    } finally {
      setPitchLoading(false);
    }
  };

  const closePitch = useCallback(() => setPitchOpen(false), []);

  return (
    <div className="app-shell">
      <TopBar selectedCount={simulation.selectedMeasures.length} />

      <main className="dashboard-grid">
        <DecisionCatalog
          selectedMeasures={simulation.selectedMeasures}
          spent={simulation.spent}
          onSelect={simulation.selectMeasure}
          onNotice={(message, tone) => setNotice({ message, tone })}
          onBalancedPlan={simulation.applyBalancedPlan}
        />

        <div className="workspace-column">
          <PlanDock
            selectedMeasures={simulation.selectedMeasures}
            spent={simulation.spent}
            canAnalyze={simulation.canAnalyze}
            isAnalyzing={analysis.status === 'streaming'}
            isStale={isStale}
            onRemove={(id) => {
              const message = simulation.removeMeasure(id);
              if (message) setNotice({ message, tone: 'success' });
            }}
            onReset={() => {
              simulation.reset();
              setNotice({ message: 'План очищен.', tone: 'success' });
            }}
            onAnalyze={handleAnalyze}
          />
          <ImpactDashboard
            projections={simulation.projections}
            cityScore={simulation.cityScores}
          />
        </div>

        <AiAnalysisPanel
          canAnalyze={simulation.canAnalyze}
          status={analysis.status}
          markdown={analysis.markdown}
          error={analysis.error}
          provider={provider}
          isStale={isStale}
          pitchLoading={pitchLoading}
          onProviderChange={setProvider}
          onAnalyze={handleAnalyze}
          onCancel={analysis.cancel}
          onGeneratePitch={() => void handleGeneratePitch()}
        />
      </main>

      <footer className="data-footer">
        <span><Database size={14} aria-hidden="true" /> Синтетический демо-датасет</span>
        <span>5 районов · 5 направлений · шкала 0–100</span>
        <span>Версия сценария 0.1</span>
      </footer>

      {notice && (
        <div className={`toast toast-${notice.tone}`} role="status" aria-live="polite">
          <span>{notice.message}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Закрыть уведомление">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      <PitchCarousel open={pitchOpen} slides={pitchSlides} onClose={closePitch} />
    </div>
  );
}

export default App;
