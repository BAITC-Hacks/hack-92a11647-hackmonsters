import { BUDGET_LIMIT, DIRECTIONS, MEASURES } from '../data';
import {
  getCityScores,
  getDirectionDeltas,
} from '../lib/simulation';
import type {
  AnalysisRequest,
  DistrictProjection,
  Measure,
} from '../types';

interface StreamInput {
  request: AnalysisRequest;
  selectedMeasures: Measure[];
  projections: DistrictProjection[];
  spent: number;
}

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });

function providerName(provider: AnalysisRequest['provider']) {
  if (provider === 'openai') return 'OpenAI';
  if (provider === 'nvidia') return 'NVIDIA NIM';
  return 'OpenAI × NVIDIA NIM';
}

function buildMockAnalysis({
  request,
  selectedMeasures,
  projections,
  spent,
}: StreamInput) {
  const score = getCityScores(projections);
  const directionDeltas = getDirectionDeltas(projections).sort(
    (a, b) => b.delta - a.delta,
  );
  const strongest = directionDeltas[0];
  const weakest = directionDeltas[directionDeltas.length - 1];
  const mostImprovedDistrict = [...projections].sort(
    (a, b) =>
      b.projectedScore - b.baselineScore -
      (a.projectedScore - a.baselineScore),
  )[0];
  const mostExpensive = [...selectedMeasures].sort((a, b) => b.cost - a.cost)[0];
  const tradeoffs = selectedMeasures
    .slice()
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 2)
    .map((measure) => `- **${measure.title}:** ${measure.tradeoff}`)
    .join('\n');

  return `## Итог сценария\n\n> **Astana Quality of Life Score: ${score.projected}/100** · прогноз ${score.delta >= 0 ? '+' : ''}${score.delta} пункта · бюджет ${spent}/${BUDGET_LIMIT} у.е.\n\nМодель **${providerName(request.provider)}** оценила пакет из пяти решений. План сохраняет ${BUDGET_LIMIT - spent} у.е. резерва и сильнее всего меняет профиль района **${mostImprovedDistrict.district.shortName}**.\n\n## Сильные стороны\n\n- Наибольший средний прирост даёт направление **${strongest.direction.label}: +${strongest.delta}**.\n- Сценарий покрывает все пять обязательных направлений и не превышает лимит.\n- Самая заметная локальная динамика — **${mostImprovedDistrict.district.shortName}: +${mostImprovedDistrict.projectedScore - mostImprovedDistrict.baselineScore}** к районному индексу.\n- **${selectedMeasures.find((item) => item.direction === strongest.direction.id)?.title ?? 'Выбранная мера'}** усиливает эффект без критической нагрузки на бюджет.\n\n## Риски и компромиссы\n\n${tradeoffs}\n- Направление **${weakest.direction.label}** получает только ${weakest.delta >= 0 ? '+' : ''}${weakest.delta}; эффект стоит проверить после первого квартала.\n- Самая дорогая мера — **${mostExpensive.title} (${mostExpensive.cost} у.е.)**. Для неё нужен контрольный milestone до полного финансирования.\n\n## Рекомендации\n\n1. Зафиксировать стартовые значения по пяти районам до запуска, чтобы не смешивать эффект мер с сезонностью.\n2. Опубликовать квартальный дашборд: бюджет, фактическая дельта и доверительный интервал по каждому направлению.\n3. Сохранить резерв **${BUDGET_LIMIT - spent} у.е.** для корректировки слабого направления после первых данных.\n\n_Это предварительный сценарный расчёт на синтетическом наборе данных. Финальное решение требует проверки исходных данных и рисков внедрения._`;
}

async function streamMock(
  input: StreamInput,
  signal: AbortSignal,
  onDelta: (delta: string) => void,
) {
  const markdown = buildMockAnalysis(input);
  const chunks = markdown.match(/.{1,18}(?:\s|$)|\n/g) ?? [markdown];

  for (const chunk of chunks) {
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    onDelta(chunk);
    await wait(18 + Math.random() * 18, signal);
  }
}

type SseEvent = { event: string; data: string };

function parseEventFrame(frame: string): SseEvent | null {
  let event = 'message';
  const data: string[] = [];

  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith(':')) continue;
    if (line.startsWith('event:')) event = line.slice(6).trim();
    if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }

  return data.length ? { event, data: data.join('\n') } : null;
}

async function streamFromApi(
  input: StreamInput,
  signal: AbortSignal,
  onDelta: (delta: string) => void,
) {
  const response = await fetch('/api/ai/analysis/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(input.request),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Сервис аналитики вернул HTTP ${response.status}.`);
  }
  if (!response.body) throw new Error('Браузер не предоставил поток ответа.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      const parsed = parseEventFrame(frame);
      if (!parsed) continue;
      const payload = JSON.parse(parsed.data) as {
        text?: string;
        message?: string;
      };
      if (parsed.event === 'delta' && payload.text) onDelta(payload.text);
      if (parsed.event === 'error') {
        throw new Error(payload.message ?? 'Поток аналитики завершился ошибкой.');
      }
      if (parsed.event === 'done') return;
    }

    if (done) break;
  }
}

export async function streamScenarioAnalysis(
  input: StreamInput,
  signal: AbortSignal,
  onDelta: (delta: string) => void,
) {
  const knownIds = new Set(MEASURES.map((measure) => measure.id));
  if (
    input.request.decisionIds.length !== 5 ||
    input.request.decisionIds.some((id) => !knownIds.has(id))
  ) {
    throw new Error('Для анализа требуется ровно 5 корректных решений.');
  }

  if (import.meta.env.VITE_ANALYSIS_MODE === 'api') {
    return streamFromApi(input, signal, onDelta);
  }

  return streamMock(input, signal, onDelta);
}

export const ANALYSIS_SECTIONS = DIRECTIONS.map((direction) => direction.label);
