import type { Metric } from './types';

export const METRICS: Metric[] = ['T1', 'T2', 'E1', 'E2', 'S1', 'S2', 'B1', 'B2', 'C1', 'C2'];

export const DIRECTIONS = [
  { label: 'Транспорт', shortLabel: 'ТР', prefix: 'T', color: '#3478f6' },
  { label: 'Экология', shortLabel: 'ЭК', prefix: 'E', color: '#2aa876' },
  { label: 'Соцсфера', shortLabel: 'СО', prefix: 'S', color: '#8854d0' },
  { label: 'Безопасность', shortLabel: 'БЗ', prefix: 'B', color: '#f08c46' },
  { label: 'Сервисы', shortLabel: 'СВ', prefix: 'C', color: '#d85273' },
];

export function categoryColor(category: string): string {
  return DIRECTIONS.find((direction) => direction.label === category)?.color ?? '#163f34';
}
