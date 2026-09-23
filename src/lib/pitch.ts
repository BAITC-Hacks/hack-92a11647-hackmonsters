import { DIRECTIONS } from '../data';
import { getCityScores, getDirectionDeltas } from './simulation';
import type {
  DistrictProjection,
  Measure,
  PitchSlideData,
} from '../types';

interface PitchInput {
  selectedMeasures: Measure[];
  projections: DistrictProjection[];
  spent: number;
}

export function buildPitchSlides({
  selectedMeasures,
  projections,
  spent,
}: PitchInput): PitchSlideData[] {
  const score = getCityScores(projections);
  const baseline = [...projections].sort(
    (a, b) => a.baselineScore - b.baselineScore,
  )[0];
  const directionDeltas = getDirectionDeltas(projections).sort(
    (a, b) => b.delta - a.delta,
  );
  const leadingDistrict = [...projections].sort(
    (a, b) =>
      b.projectedScore - b.baselineScore -
      (a.projectedScore - a.baselineScore),
  )[0];

  return [
    {
      id: 'context',
      eyebrow: '01 · Контекст',
      title: 'Пять часов, чтобы изменить траекторию города',
      bullets: [
        `Стартовый городской индекс — ${score.baseline}/100.`,
        `Самая уязвимая точка — ${baseline.district.shortName}: ${baseline.baselineScore}/100.`,
        'Цель — сбалансировать пять направлений без превышения бюджета.',
      ],
      metrics: [
        { label: 'Бюджет', value: '100 у.е.' },
        { label: 'Районов', value: '5' },
        { label: 'Решений', value: '5' },
      ],
      speakerNotes:
        'Начните с ограничения: одинаковый бюджет для всех команд и необходимость сделать осознанный выбор.',
      tone: 'ink',
    },
    {
      id: 'plan',
      eyebrow: '02 · План',
      title: 'Одна связная программа вместо пяти разрозненных мер',
      bullets: selectedMeasures.map((measure) => {
        const direction = DIRECTIONS.find((item) => item.id === measure.direction);
        return `${direction?.label}: ${measure.title} — ${measure.cost} у.е.`;
      }),
      metrics: [
        { label: 'Использовано', value: `${spent}/100` },
        { label: 'Резерв', value: `${100 - spent} у.е.` },
      ],
      speakerNotes:
        'Свяжите каждую меру с конкретным городским результатом; не читайте список как закупочную ведомость.',
      tone: 'blue',
    },
    {
      id: 'impact',
      eyebrow: '03 · Эффект',
      title: `Quality of Life Score растёт до ${score.projected}/100`,
      bullets: [
        `Лидер роста — ${directionDeltas[0].direction.label}: +${directionDeltas[0].delta}.`,
        `${leadingDistrict.district.shortName} получает наибольшую суммарную дельту.`,
        'Единая шкала 0–100 позволяет честно сравнить районы и направления.',
      ],
      metrics: directionDeltas.slice(0, 3).map((item) => ({
        label: item.direction.label,
        value: `+${item.delta}`,
        delta: item.delta,
      })),
      speakerNotes:
        'Подчеркните, что числовой preview рассчитывается структурированной моделью, а LLM только объясняет результат.',
      tone: 'mint',
    },
    {
      id: 'risks',
      eyebrow: '04 · Контроль',
      title: 'Результат измерим — риски управляемы',
      bullets: [
        [...selectedMeasures].sort((a, b) => b.cost - a.cost)[0].tradeoff,
        `Слабее всего меняется направление «${directionDeltas.at(-1)?.direction.label}» — нужен квартальный контроль.`,
        'Публикуем baseline, фактические дельты и причины отклонений.',
        'Решение: пилот → проверка данных → масштабирование.',
      ],
      metrics: [
        { label: 'Резерв', value: `${100 - spent} у.е.` },
        { label: 'Контроль', value: '90 дней' },
      ],
      speakerNotes:
        'Завершите конкретным следующим шагом: 90-дневный пилот и открытая проверка показателей.',
      tone: 'amber',
    },
  ];
}
