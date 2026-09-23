import { useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { formatDelta, formatNumber } from "../lib/simulation";
import type { SimulationResult } from "../types";

export function ImpactDashboard({
  result,
  labels,
}: {
  result: SimulationResult;
  labels: Record<string, string>;
}) {
  const [districtId, setDistrictId] = useState("nura");
  const district =
    result.districts.find((d) => d.id === districtId) ?? result.districts[0];
  const data = Object.entries(district.metrics).map(([metric, change]) => ({
    metric,
    ...change,
  }));
  const breakdown = result.score_breakdown;
  return (
    <section className="panel impact-panel" aria-labelledby="impact-title">
      <div className="panel-heading impact-heading">
        <div>
          <p className="eyebrow">Расчёт бэкенда</p>
          <h2 id="impact-title">Карта эффекта</h2>
        </div>
        <div className="quality-score">
          <div>
            <span>Astana Quality of Life</span>
            <small>
              {formatNumber(result.score.base)} →{" "}
              {formatNumber(result.score.final)}
            </small>
          </div>
          <strong>{formatNumber(result.score.final)}</strong>
          <em>{formatDelta(result.score.delta)}</em>
        </div>
      </div>
      <div className="score-breakdown">
        <p>
          Score = {result.methodology.city_average_weight} × средний индекс +{" "}
          {result.methodology.weakest_district_weight} × индекс слабейшего
          района − штраф.
        </p>
        <dl>
          <div>
            <dt>Средний индекс</dt>
            <dd>{formatNumber(breakdown.weighted_average.final)}</dd>
          </div>
          <div>
            <dt>Слабейший район</dt>
            <dd>{formatNumber(breakdown.weakest_district_score.final)}</dd>
          </div>
          <div>
            <dt>Критические показатели</dt>
            <dd>
              {breakdown.n_crit_base} → {breakdown.n_crit_final}
            </dd>
          </div>
          <div>
            <dt>Штраф</dt>
            <dd>
              {formatNumber(breakdown.critical_penalty.base)} →{" "}
              {formatNumber(breakdown.critical_penalty.final)}
            </dd>
          </div>
        </dl>
      </div>
      <div className="district-tabs" role="tablist" aria-label="Выберите район">
        {result.districts.map((d) => (
          <button
            type="button"
            role="tab"
            key={d.id}
            aria-selected={d.id === district.id}
            className={`district-tab${d.id === district.id ? " is-active" : ""}`}
            onClick={() => setDistrictId(d.id)}
          >
            <span>{d.name}</span>
            <strong>{formatDelta(d.score.delta)}</strong>
          </button>
        ))}
      </div>
      <div className="impact-body">
        <div className="radar-column">
          <div className="chart-title-row">
            <div>
              <h3>{district.name}</h3>
              <p>
                Индекс района: {formatNumber(district.score.base)} →{" "}
                {formatNumber(district.score.final)}
              </p>
            </div>
            <div className="chart-legend">
              <span>
                <i className="legend-before" />
                До
              </span>
              <span>
                <i className="legend-after" />
                После
              </span>
            </div>
          </div>
          <div className="radar-wrap">
            <ResponsiveContainer
              width="100%"
              height="100%"
              initialDimension={{ width: 420, height: 290 }}
            >
              <RadarChart data={data} accessibilityLayer>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" />
                <PolarRadiusAxis
                  domain={[0, 100]}
                  tick={false}
                  axisLine={false}
                />
                <Radar
                  name="До"
                  dataKey="base"
                  stroke="#89958f"
                  fill="#89958f"
                  fillOpacity={0.05}
                  isAnimationActive={false}
                />
                <Radar
                  name="После"
                  dataKey="final"
                  stroke="#163f34"
                  fill="#7fe0bd"
                  fillOpacity={0.32}
                  isAnimationActive={false}
                />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="matrix-column">
          <h3>Показатели выбранного района</h3>
          <div className="impact-matrix-wrap">
            <table className="impact-matrix metric-details">
              <thead>
                <tr>
                  <th>Показатель</th>
                  <th>До</th>
                  <th>После</th>
                  <th>Δ</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.metric}>
                    <th scope="row">
                      {item.metric} · {labels[item.metric]}
                    </th>
                    <td>{formatNumber(item.base)}</td>
                    <td>{formatNumber(item.final)}</td>
                    <td className={item.delta < 0 ? "is-negative" : ""}>
                      {formatDelta(item.delta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="all-districts">
        <h3>Дельты по всем районам</h3>
        <div className="impact-matrix-wrap">
          <table className="impact-matrix">
            <thead>
              <tr>
                <th>Район</th>
                {Object.keys(labels).map((code) => (
                  <th key={code} title={labels[code]}>
                    {code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.districts.map((d) => (
                <tr key={d.id}>
                  <th scope="row">{d.name}</th>
                  {Object.keys(labels).map((code) => (
                    <td
                      key={code}
                      title={`${labels[code]}: ${d.metrics[code].base} → ${d.metrics[code].final}`}
                    >
                      {formatDelta(d.metrics[code].delta)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="matrix-note">
          Показатели — по шкале от 0 до 100, больше означает лучше. Значения
          ниже 40 учитываются в городском штрафе. Горизонт:{" "}
          {result.methodology.horizon_periods} кв.
        </p>
      </div>
      {result.warnings.map((w) => (
        <p className="validation-hint" key={w}>
          {w}
        </p>
      ))}
    </section>
  );
}
