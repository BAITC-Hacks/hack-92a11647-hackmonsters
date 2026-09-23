import { requestJson } from './api';
import type { AnalysisProvider, AnalysisResponse, Assessment, SimulationRequest } from '../types';

export function analyzeScenario(plan: SimulationRequest, provider: AnalysisProvider, signal: AbortSignal) {
  return requestJson<AnalysisResponse>('/api/analyze', signal, { ...plan, provider });
}

export function assessmentMarkdown(assessment: Assessment): string {
  return [
    '## Общая оценка', assessment.general_assessment,
    '## Сильные стороны', ...assessment.strengths.map((item) => `- ${item}`),
    '## Риски и штрафы', ...assessment.risks_and_penalties.map((item) => `- ${item}`),
    '## Рекомендации', ...assessment.recommendations.map((item) => `- ${item}`),
  ].join('\n\n');
}
