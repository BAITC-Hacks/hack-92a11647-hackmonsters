export type Direction =
  | 'transport'
  | 'ecology'
  | 'social'
  | 'safety'
  | 'services';

export type DistrictId = 'esil' | 'saryarka' | 'almaty' | 'baikonyr' | 'nura';

export type ScoreVector = Record<Direction, number>;

export interface DirectionMeta {
  id: Direction;
  label: string;
  fullLabel: string;
  shortLabel: string;
  color: string;
}

export interface District {
  id: DistrictId;
  name: string;
  shortName: string;
  baseline: ScoreVector;
  sensitivity: ScoreVector;
}

export interface Measure {
  id: string;
  title: string;
  description: string;
  direction: Direction;
  cost: number;
  duration: string;
  coverage: 'citywide' | DistrictId[];
  impact: ScoreVector;
  tradeoff: string;
  badge?: string;
}

export interface DistrictProjection {
  district: District;
  baseline: ScoreVector;
  projected: ScoreVector;
  delta: ScoreVector;
  baselineScore: number;
  projectedScore: number;
}

export type AnalysisProvider = 'openai' | 'nvidia' | 'consensus';

export type StreamStatus = 'idle' | 'streaming' | 'complete' | 'cancelled' | 'error';

export interface AnalysisRequest {
  decisionIds: string[];
  provider: AnalysisProvider;
  locale: 'ru-KZ';
  budgetLimit: number;
}

export interface PitchMetric {
  label: string;
  value: string;
  delta?: number;
}

export interface PitchSlideData {
  id: string;
  eyebrow: string;
  title: string;
  bullets: string[];
  metrics?: PitchMetric[];
  speakerNotes: string;
  tone: 'ink' | 'mint' | 'amber' | 'blue';
}
