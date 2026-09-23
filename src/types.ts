// API field names deliberately match the server's OpenAPI contract.
export interface Measure {
  id: string;
  name: string;
  category: string;
  measure_type: "District" | "City";
  cost: number;
  lag: number;
  effects: Record<string, number>;
}
export interface District {
  id: string;
  name: string;
  population_share: number;
  metrics: Record<string, number>;
}
export interface Plan {
  measure_ids: string[];
  district_assignments: Record<string, string>;
}
export interface Rules {
  version: string;
  horizon_periods: number;
  period_unit: string;
  city_average_weight: number;
  weakest_district_weight: number;
  critical_penalty: number;
}
export interface Catalog {
  dataset: {
    districts: District[];
    measures: Measure[];
    conflicts: { pair: [string, string]; scope: "global" | "same_district" }[];
  };
  rules: Rules;
  budget_limit: number;
  required_decisions: number;
  max_per_category: number;
  metric_labels: Record<string, string>;
  example_plan: Plan;
  ai_available: boolean;
}
export interface Change {
  base: number;
  final: number;
  delta: number;
}
export interface SimulationResult {
  schema_version: string;
  critical_threshold: number;
  is_valid: true;
  budget: { limit: number; spent: number; remaining: number; unit: string };
  score: Change;
  score_breakdown: {
    weighted_average: Change;
    weakest_district_score: Change;
    average_component: Change;
    weakest_component: Change;
    critical_penalty: Change;
    n_crit_base: number;
    n_crit_final: number;
  };
  districts: (Omit<District, "metrics"> & {
    score: Change;
    metrics: Record<string, Change>;
    critical_metrics_final: string[];
  })[];
  selected_measures: (Omit<Measure, "effects"> & {
    target_districts: string[];
    lag_factor: number;
  })[];
  methodology: Rules;
  warnings: string[];
}
export interface Assessment {
  general_assessment: string;
  strengths: string[];
  risks_and_penalties: string[];
  recommendations: string[];
}
export interface AnalysisResponse {
  simulation: SimulationResult;
  assessment: Assessment;
}
export type AnalysisStatus =
  | "idle"
  | "loading"
  | "complete"
  | "cancelled"
  | "error";
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
  tone: "ink" | "mint" | "amber" | "blue";
}
