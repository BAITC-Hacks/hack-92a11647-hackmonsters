import { useCallback, useEffect, useRef, useState } from 'react';
import { streamScenarioAnalysis } from '../services/analysisStream';
import type {
  AnalysisProvider,
  DistrictProjection,
  Measure,
  StreamStatus,
} from '../types';

interface StartOptions {
  selectedMeasures: Measure[];
  projections: DistrictProjection[];
  spent: number;
  provider: AnalysisProvider;
  planKey: string;
}

export function useAnalysisStream() {
  const [markdown, setMarkdown] = useState('');
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [error, setError] = useState('');
  const [analyzedPlanKey, setAnalyzedPlanKey] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const pendingRef = useRef('');
  const frameRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (pendingRef.current) {
      const pending = pendingRef.current;
      pendingRef.current = '';
      setMarkdown((current) => current + pending);
    }
    frameRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    flush();
    setStatus((current) => (current === 'streaming' ? 'cancelled' : current));
  }, [flush]);

  const start = useCallback(
    async (options: StartOptions) => {
      abortRef.current?.abort();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      pendingRef.current = '';
      const controller = new AbortController();
      abortRef.current = controller;
      setMarkdown('');
      setError('');
      setStatus('streaming');
      setAnalyzedPlanKey(options.planKey);

      try {
        await streamScenarioAnalysis(
          {
            request: {
              decisionIds: options.selectedMeasures.map((item) => item.id),
              provider: options.provider,
              locale: 'ru-KZ',
              budgetLimit: 100,
            },
            selectedMeasures: options.selectedMeasures,
            projections: options.projections,
            spent: options.spent,
          },
          controller.signal,
          (delta) => {
            pendingRef.current += delta;
            if (frameRef.current === null) {
              frameRef.current = requestAnimationFrame(flush);
            }
          },
        );
        flush();
        if (!controller.signal.aborted) setStatus('complete');
      } catch (caught) {
        flush();
        if (caught instanceof DOMException && caught.name === 'AbortError') {
          setStatus('cancelled');
          return;
        }
        setError(caught instanceof Error ? caught.message : 'Не удалось получить анализ.');
        setStatus('error');
      }
    },
    [flush],
  );

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  return {
    markdown,
    status,
    error,
    analyzedPlanKey,
    start,
    cancel,
  };
}
