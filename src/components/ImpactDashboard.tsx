import { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Info,
  Minus,
  Radar as RadarIcon,
} from 'lucide-react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { DIRECTIONS } from '../data';
import { formatDelta } from '../lib/simulation';
import type { Direction, DistrictId, DistrictProjection } from '../types';

interface ImpactDashboardProps {
  projections: DistrictProjection[];
  cityScore: {
    baseline: number;
    projected: number;
    delta: number;
  };
}

export function ImpactDashboard({ projections, cityScore }: ImpactDashboardProps) {
  const [selectedDistrictId, setSelectedDistrictId] =
    useState<DistrictId>('baikonyr');
  const selected =
    projections.find((item) => item.district.id === selectedDistrictId) ??
    projections[0];

  const chartData = useMemo(
    () =>
      DIRECTIONS.map((direction) => ({
        direction: direction.id,
        label: direction.label,
        baseline: selected.baseline[direction.id],
        projected: selected.projected[direction.id],
        delta: selected.delta[direction.id],
      })),
    [selected],
  );

  const improvements = chartData.filter((item) => item.delta > 0).length;
  const declines = chartData.filter((item) => item.delta < 0).length;

  return (
    <section className="panel impact-panel" aria-labelledby="impact-title">
      <div className="panel-heading impact-heading">
        <div>
          <p className="eyebrow">Предварительная модель</p>
          <div className="heading-line">
            <h2 id="impact-title">Карта эффекта</h2>
            <span className="model-badge">preview</span>
          </div>
        </div>
        <div className="quality-score" aria-label={`Прогнозный индекс ${cityScore.projected} из 100`}>
          <div>
            <span>Astana Quality of Life</span>
            <small>
              {cityScore.baseline} → {cityScore.projected}
            </small>
          </div>
          <strong>{cityScore.projected}</strong>
          <em>+{cityScore.delta}</em>
        </div>
      </div>

      <div className="district-tabs" role="tablist" aria-label="Выберите район">
        {projections.map((projection) => {
          const delta = projection.projectedScore - projection.baselineScore;
          return (
            <button
              key={projection.district.id}
              type="button"
              role="tab"
              aria-selected={projection.district.id === selectedDistrictId}
              className={
                projection.district.id === selectedDistrictId
                  ? 'district-tab is-active'
                  : 'district-tab'
              }
              onClick={() => setSelectedDistrictId(projection.district.id)}
            >
              <span>{projection.district.shortName}</span>
              <strong>{formatDelta(delta)}</strong>
            </button>
          );
        })}
      </div>

      <div className="impact-body">
        <div className="radar-column">
          <div className="chart-title-row">
            <div>
              <h3>{selected.district.name}</h3>
              <p>
                {improvements} улучшений
                {declines ? ` · ${declines} снижение` : ' · без снижений'}
              </p>
            </div>
            <div className="chart-legend" aria-label="Легенда графика">
              <span><i className="legend-before" /> До</span>
              <span><i className="legend-after" /> После</span>
            </div>
          </div>
          <div className="radar-wrap">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height: 290 }}>
              <RadarChart
                data={chartData}
                margin={{ top: 16, right: 34, bottom: 12, left: 34 }}
                accessibilityLayer
                title={`Профиль показателей, ${selected.district.name}`}
                desc="Сравнение исходных и прогнозных показателей по шкале от 0 до 100"
              >
                <PolarGrid stroke="#dce2dc" />
                <PolarAngleAxis
                  dataKey="label"
                  tick={{ fill: '#53615b', fontSize: 11, fontWeight: 600 }}
                />
                <PolarRadiusAxis
                  domain={[0, 100]}
                  tick={false}
                  axisLine={false}
                />
                <Radar
                  name="До"
                  dataKey="baseline"
                  stroke="#89958f"
                  fill="#89958f"
                  fillOpacity={0.04}
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  isAnimationActive="auto"
                />
                <Radar
                  name="После"
                  dataKey="projected"
                  stroke="#163f34"
                  fill="#7fe0bd"
                  fillOpacity={0.32}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#163f34', strokeWidth: 0 }}
                  isAnimationActive="auto"
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="delta-strip" aria-label="Дельты выбранного района">
            {chartData.map((item) => (
              <div key={item.direction}>
                <span>{DIRECTIONS.find((direction) => direction.id === item.direction)?.shortLabel}</span>
                <strong className={item.delta < 0 ? 'is-negative' : ''}>
                  {formatDelta(item.delta)}
                </strong>
              </div>
            ))}
          </div>
        </div>

        <div className="matrix-column">
          <div className="matrix-title">
            <div>
              <h3>Дельты по районам</h3>
              <p>пункты к исходному индексу</p>
            </div>
            <button
              className="icon-button subtle"
              type="button"
              aria-label="О методике расчёта"
              title="Projected = baseline + сумма эффектов выбранных мер, шкала 0–100"
            >
              <Info size={15} aria-hidden="true" />
            </button>
          </div>
          <div className="impact-matrix-wrap">
            <table className="impact-matrix">
              <caption className="sr-only">
                Изменения показателей пяти районов по пяти направлениям
              </caption>
              <thead>
                <tr>
                  <th scope="col">Район</th>
                  {DIRECTIONS.map((direction) => (
                    <th scope="col" key={direction.id} title={direction.fullLabel}>
                      {direction.shortLabel}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projections.map((projection) => (
                  <tr key={projection.district.id}>
                    <th scope="row">{projection.district.shortName}</th>
                    {DIRECTIONS.map((direction) => {
                      const delta = projection.delta[direction.id];
                      return (
                        <td key={direction.id}>
                          <button
                            type="button"
                            className={`matrix-cell ${heatClass(delta)}`}
                            title={`${projection.district.shortName}, ${direction.label}: ${projection.baseline[direction.id]} → ${projection.projected[direction.id]} (${formatDelta(delta)})`}
                            onClick={() => setSelectedDistrictId(projection.district.id)}
                          >
                            {delta > 0 ? (
                              <ArrowUpRight size={11} aria-hidden="true" />
                            ) : delta < 0 ? (
                              <ArrowDownRight size={11} aria-hidden="true" />
                            ) : (
                              <Minus size={11} aria-hidden="true" />
                            )}
                            {formatDelta(delta)}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="matrix-note">
            <RadarIcon size={16} aria-hidden="true" />
            <span>
              Radar показывает «до / после» выбранного района; матрица сохраняет точные
              значения для всех 25 сочетаний.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function heatClass(value: number) {
  if (value < 0) return 'heat-negative';
  if (value === 0) return 'heat-zero';
  if (value <= 2) return 'heat-low';
  if (value <= 5) return 'heat-medium';
  return 'heat-high';
}

export type MatrixDirection = Direction;
