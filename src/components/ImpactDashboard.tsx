import { useState } from 'react';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from 'recharts';
import { DIRECTIONS, METRICS } from '../data';
import { formatDelta } from '../lib/simulation';
import type { Catalog, SimulationResult } from '../types';

export function ImpactDashboard({ catalog, result }: { catalog: Catalog; result: SimulationResult | null }) {
  const [districtId, setDistrictId] = useState('nura');
  const districts = result?.districts ?? catalog.baseline.districts;
  const selected = districts.find((district) => district.id === districtId) ?? districts[0];
  const chartData = METRICS.map((metric) => ({ metric, ...selected.metrics[metric] }));
  const score = result?.score ?? { base: catalog.baseline.score, final: catalog.baseline.score, delta: 0 };
  const breakdown = result?.score_breakdown ?? catalog.baseline.score_breakdown;

  return (
    <section className="panel impact-panel" aria-labelledby="impact-title">
      <div className="panel-heading impact-heading">
        <div><p className="eyebrow">{result ? 'Проверенный серверный расчёт' : 'Исходное состояние · план ещё не рассчитан'}</p>
          <div className="heading-line"><h2 id="impact-title">Карта эффекта</h2><span className="model-badge">v2</span></div>
        </div>
        <div className="quality-score" aria-label={`Astana Quality of Life Score: ${score.final}`}>
          <div><span>Astana Quality of Life</span><small>{score.base} → {score.final}</small></div>
          <strong title={String(score.final)}>{score.final.toFixed(2)}</strong><em>{formatDelta(score.delta)}</em>
        </div>
      </div>
      <div className="district-tabs" role="tablist" aria-label="Выберите район">
        {districts.map((district) => <button key={district.id} type="button" role="tab" aria-selected={district.id === selected.id}
          className={district.id === selected.id ? 'district-tab is-active' : 'district-tab'} onClick={() => setDistrictId(district.id)}>
          <span>{district.name}</span><strong>{formatDelta(district.score.delta)}</strong>
        </button>)}
      </div>
      <div className="impact-body">
        <div className="radar-column">
          <div className="chart-title-row"><div><h3>{selected.name}</h3><p>D: {selected.score.base} → {selected.score.final}</p></div>
            <div className="chart-legend"><span><i className="legend-before" />До</span><span><i className="legend-after" />После</span></div>
          </div>
          <div className="radar-wrap">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height: 290 }}>
              <RadarChart data={chartData} margin={{ top: 18, right: 30, bottom: 15, left: 30 }} accessibilityLayer>
                <PolarGrid stroke="#dce2dc" /><PolarAngleAxis dataKey="metric" tick={{ fill: '#53615b', fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="До" dataKey="base" stroke="#89958f" fill="#89958f" fillOpacity={0.04} strokeDasharray="5 5" />
                <Radar name="После" dataKey="final" stroke="#163f34" fill="#7fe0bd" fillOpacity={0.32} strokeWidth={2.5} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <p className="matrix-note">{DIRECTIONS.map((direction) => `${direction.prefix}: ${direction.label}`).join(' · ')}</p>
        </div>
        <div className="matrix-column">
          <div className="matrix-title"><div><h3>Точные дельты показателей</h3><p>С учётом лага, синергий и границ 0–100</p></div></div>
          <div className="impact-matrix-wrap">
            <table className="impact-matrix"><caption className="sr-only">Дельты десяти показателей пяти районов</caption>
              <thead><tr><th scope="col">Район</th>{METRICS.map((metric) => <th scope="col" key={metric}>{metric}</th>)}</tr></thead>
              <tbody>{districts.map((district) => <tr key={district.id}><th scope="row">{district.name}</th>
                {METRICS.map((metric) => <td key={metric}><button type="button"
                  className={`matrix-cell ${district.metrics[metric].delta < 0 ? 'heat-negative' : district.metrics[metric].delta > 0 ? 'heat-medium' : 'heat-zero'}`}
                  title={`${district.name}, ${metric}: ${district.metrics[metric].base} → ${district.metrics[metric].final}`}
                  onClick={() => setDistrictId(district.id)}>{formatDelta(district.metrics[metric].delta)}</button></td>)}
              </tr>)}</tbody>
            </table>
          </div>
          <div className="matrix-note">Показателей ниже 40: {breakdown.n_crit_base} → {breakdown.n_crit_final}. Штраф города: {breakdown.critical_penalty.base} → {breakdown.critical_penalty.final}.</div>
          <div className="matrix-note">Score учитывает взвешенный D, слабейший район и штраф. Сам Score не ограничивается диапазоном 0–100.</div>
        </div>
      </div>
      {result?.warnings.map((warning) => <p className="validation-hint is-error" key={warning}>{warning}</p>)}
    </section>
  );
}
