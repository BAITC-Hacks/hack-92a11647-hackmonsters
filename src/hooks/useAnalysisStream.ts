import { useCallback, useEffect, useRef, useState } from 'react';
import { analyzeScenario, assessmentMarkdown } from '../services/analysisStream';
import type { AnalysisProvider, SimulationRequest, StreamStatus } from '../types';

export function useAnalysisStream() {
  const [markdown, setMarkdown] = useState('');
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [error, setError] = useState('');
  const [providerUsed, setProviderUsed] = useState('');
  const [analyzedPlanKey, setAnalyzedPlanKey] = useState('');
  const controllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    setStatus((current) => current === 'streaming' ? 'cancelled' : current);
  }, []);

  const start = useCallback(async (plan: SimulationRequest, provider: AnalysisProvider, key: string) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setMarkdown('');
    setError('');
    setProviderUsed('');
    setAnalyzedPlanKey(key);
    setStatus('streaming');
    try {
      const response = await analyzeScenario(plan, provider, controller.signal);
      if (controller.signal.aborted || controllerRef.current !== controller) return;
      setMarkdown(assessmentMarkdown(response.assessment));
      setProviderUsed(response.provider_used);
      setStatus('complete');
    } catch (caught) {
      if (controller.signal.aborted || controllerRef.current !== controller) return;
      setError(caught instanceof Error ? caught.message : 'Не удалось получить анализ.');
      setStatus('error');
    }
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);
  return { markdown, status, error, providerUsed, analyzedPlanKey, start, cancel };
}
