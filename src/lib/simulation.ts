import { DIRECTIONS, DISTRICTS } from '../data';
import type {
  Direction,
  DistrictProjection,
  Measure,
  ScoreVector,
} from '../types';

export const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, value));

export const vectorAverage = (vector: ScoreVector) =>
  Math.round(
    DIRECTIONS.reduce((sum, direction) => sum + vector[direction.id], 0) /
      DIRECTIONS.length,
  );

const coverageFactor = (measure: Measure, districtId: string) => {
  if (measure.coverage === 'citywide') return 0.72;
  return measure.coverage.includes(districtId as never) ? 1 : 0.18;
};

export function calculateProjections(measures: Measure[]): DistrictProjection[] {
  return DISTRICTS.map((district) => {
    const delta = DIRECTIONS.reduce<ScoreVector>((result, direction) => {
      const raw = measures.reduce((sum, measure) => {
        const measureDelta = measure.impact[direction.id];
        return sum + measureDelta * coverageFactor(measure, district.id);
      }, 0);

      result[direction.id] = Math.round(raw * district.sensitivity[direction.id]);
      return result;
    }, {} as ScoreVector);

    const projected = DIRECTIONS.reduce<ScoreVector>((result, direction) => {
      result[direction.id] = clamp(
        district.baseline[direction.id] + delta[direction.id],
      );
      return result;
    }, {} as ScoreVector);

    return {
      district,
      baseline: district.baseline,
      projected,
      delta,
      baselineScore: vectorAverage(district.baseline),
      projectedScore: vectorAverage(projected),
    };
  });
}

export function getCityScores(projections: DistrictProjection[]) {
  const baseline = Math.round(
    projections.reduce((sum, district) => sum + district.baselineScore, 0) /
      projections.length,
  );
  const projected = Math.round(
    projections.reduce((sum, district) => sum + district.projectedScore, 0) /
      projections.length,
  );

  return { baseline, projected, delta: projected - baseline };
}

export function getDirectionDeltas(projections: DistrictProjection[]) {
  return DIRECTIONS.map((direction) => ({
    direction,
    delta: Math.round(
      projections.reduce(
        (sum, district) => sum + district.delta[direction.id],
        0,
      ) / projections.length,
    ),
  }));
}

export function formatDelta(value: number) {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;
  return '0';
}

export function directionLabel(direction: Direction) {
  return DIRECTIONS.find((item) => item.id === direction)?.label ?? direction;
}
