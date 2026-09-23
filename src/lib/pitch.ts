import type { PitchSlideData, SimulationResult } from '../types';
import { formatDelta } from './simulation';

export function buildPitchSlides(result: SimulationResult): PitchSlideData[] {
  return [
    {
      id: 'context', eyebrow: '01 · Методика', title: 'Аким на 5 часов',
      bullets: [
        `Исходный городской Score: ${result.score.base}.`,
        `Горизонт: ${result.methodology.horizon_periods} (${result.methodology.period_unit}).`,
        `Методика: ${result.methodology.version}; статус: ${result.methodology.status}.`,
      ],
      speakerNotes: 'Слайды собраны из серверного расчёта по шаблону, без генерации дополнительных фактов.',
      tone: 'ink',
    },
    {
      id: 'plan', eyebrow: '02 · План', title: 'Выбранные меры',
      bullets: result.selected_measures.map((measure) =>
        `${measure.id}: ${measure.name} — ${measure.cost} у.е.; ${measure.target_districts.map((id) => result.districts.find((district) => district.id === id)?.name ?? id).join(', ')}.`),
      metrics: [
        { label: 'Расходы', value: `${result.budget.spent} у.е.` },
        { label: 'Остаток', value: `${result.budget.remaining} у.е.` },
      ],
      speakerNotes: 'Общегородские меры оплачиваются один раз. Районные меры имеют явно заданный район.',
      tone: 'blue',
    },
    {
      id: 'impact', eyebrow: '03 · Результат', title: `Score: ${result.score.final}`,
      bullets: result.districts.map((district) => `${district.name}: D ${district.score.base} → ${district.score.final} (${formatDelta(district.score.delta)}).`),
      metrics: [{ label: 'Дельта Score', value: formatDelta(result.score.delta), delta: result.score.delta }],
      speakerNotes: 'Score рассчитан сервером с учётом долей населения, слабейшего района и критических показателей. Он не равен среднему по районам.',
      tone: 'mint',
    },
    {
      id: 'risks', eyebrow: '04 · Контроль', title: 'Штрафы и ограничения',
      bullets: [
        `Критических показателей: ${result.score_breakdown.n_crit_final}.`,
        `Штраф города: ${result.score_breakdown.critical_penalty.final}.`,
        ...result.warnings,
        'Результат — модельный сценарий, а не обещание фактического эффекта.',
      ],
      speakerNotes: 'Рекомендации AI требуют проверки командой. Новый набор мер нужно рассчитать заново.',
      tone: 'amber',
    },
  ];
}
