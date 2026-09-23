export type Metric = 'T1' | 'T2' | 'E1' | 'E2' | 'S1' | 'S2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface Change {
  base: number;
  final: number;
  delta: number;
}

export interface Measure {
  id: string;
  name: string;
  category: string;
  measure_type: 'City' | 'District';
  cost: number;
  lag: number;
  effects: Partial<Record<Metric, number>>;
}

export interface DistrictResult {
  id: string;
  name: string;
  score: Change;
  metrics: Record<Metric, Change>;
  critical_metrics_base: Metric[];
  critical_metrics_final: Metric[];
}

export interface ScoreBreakdown {
  weighted_average: Change;
  weakest_district_score: Change;
  average_component: Change;
  weakest_component: Change;
  critical_penalty: Change;
  n_crit_base: number;
  n_crit_final: number;
}

export interface Methodology {
  version: string;
  status: 'confirmed' | 'provisional';
  horizon_periods: number;
  period_unit: string;
}

export interface SimulationRequest {
  measure_ids: string[];
  district_assignments: Record<string, string>;
}

export interface SimulationResult {
  schema_version: string;
  is_valid: true;
  budget: { limit: number; spent: number; remaining: number; unit: string };
  score: Change;
  score_breakdown: ScoreBreakdown;
  districts: DistrictResult[];
  selected_measures: (Omit<Measure, 'effects'> & { target_districts: string[]; lag_factor: number })[];
  methodology: Methodology;
  assumptions: string[];
  warnings: string[];
}

export interface Catalog {
  dataset: {
    districts: { id: string; name: string }[];
    measures: Measure[];
    conflicts: { pair: string[]; scope: 'global' | 'same_district' }[];
  };
  baseline: { score: number; districts: DistrictResult[]; score_breakdown: ScoreBreakdown };
  methodology: Methodology;
  budget_limit: number;
  required_decisions: number;
  max_per_category: number;
}

export type AnalysisProvider = 'auto' | 'openai' | 'nvidia';
export type StreamStatus = 'idle' | 'streaming' | 'complete' | 'cancelled' | 'error';

export interface Assessment {
  general_assessment: string;
  strengths: string[];
  risks_and_penalties: string[];
  recommendations: string[];
}

export interface AnalysisResponse {
  simulation: SimulationResult;
  assessment: Assessment;
  provider_used: string;
}

export interface PitchSlideData {
  id: string;
  eyebrow: string;
  title: string;
  bullets: string[];
  metrics?: { label: string; value: string; delta?: number }[];
  speakerNotes: string;
  tone: 'ink' | 'mint' | 'amber' | 'blue';
}
