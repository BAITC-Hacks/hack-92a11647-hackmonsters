import { useEffect, useRef, useState } from 'react';
import { Bot, Check, Pause, WandSparkles } from 'lucide-react';
import { formatDelta } from '../lib/simulation';
import { requestJson } from '../services/api';
import type { AgentObjective, AgentResult, AnalysisProvider, SimulationRequest } from '../types';

const OBJECTIVES: { value: AgentObjective; label: string }[] = [
  { value: 'city_score', label: 'Повысить городской Score' },
  { value: 'weakest_district', label: 'Поддержать слабейший район' },
  { value: 'critical_metrics', label: 'Уменьшить критические показатели' },
];

interface Props {
  plan: SimulationRequest;
  planKey: string;
  planValid: boolean;
  provider: AnalysisProvider;
  analysisBusy: boolean;
  onApply: (proposal: SimulationRequest) => void;
  onBusyChange: (busy: boolean) => void;
}

export function AgentPlanner({ plan, planKey, planValid, provider, analysisBusy, onApply, onBusyChange }: Props) {
  const [objective, setObjective] = useState<AgentObjective>('city_score');
  const [proposal, setProposal] = useState<AgentResult | null>(null);
  const [requestKey, setRequestKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const currentKey = `${planKey}|${provider}|${objective}`;
  const stale = Boolean(requestKey && requestKey !== currentKey);
  const canStart = !analysisBusy && !busy && (planValid || plan.measure_ids.length === 0);

  useEffect(() => {
    onBusyChange(busy);
    return () => onBusyChange(false);
  }, [busy, onBusyChange]);

  useEffect(() => {
    if (!stale || !busy) return;
    controllerRef.current?.abort();
    setBusy(false);
    setCancelled(true);
  }, [stale, busy]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const run = async () => {
    if (!canStart) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setRequestKey(currentKey);
    setProposal(null);
    setError('');
    setCancelled(false);
    setBusy(true);
    try {
      const result = await requestJson<AgentResult>('/api/agent/plan', controller.signal, {
        objective, provider, current_plan: planValid ? plan : null,
      });
      if (!controller.signal.aborted && controllerRef.current === controller) setProposal(result);
    } catch (caught) {
      if (!controller.signal.aborted && controllerRef.current === controller)
        setError(caught instanceof Error ? caught.message : 'Не удалось получить предложение агента.');
    } finally {
      if (controllerRef.current === controller) setBusy(false);
    }
  };

  return (
    <section className="panel agent-panel" aria-labelledby="agent-title">
      <div className="panel-heading">
        <div><p className="eyebrow">Инструменты + проверка калькулятором</p>
          <h2 id="agent-title"><Bot size={19} aria-hidden="true" /> AI-агент: планировщик</h2>
        </div>
      </div>
      <p>Агент предлагает пять мер, сравнивает замены и районы. Текущий план не меняется без вашего подтверждения.</p>
      <label className="agent-objective">Цель агента
        <select value={objective} onChange={(event) => setObjective(event.target.value as AgentObjective)}>
          {OBJECTIVES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <div className="agent-actions">
        <button type="button" className="secondary-action" disabled={!canStart} onClick={() => void run()}>
          <WandSparkles size={16} />{busy ? 'Агент проверяет варианты…' : 'Предложить план с AI-агентом'}
        </button>
        {busy && <button type="button" className="ghost-button" onClick={() => {
          controllerRef.current?.abort(); setBusy(false); setCancelled(true);
        }}><Pause size={15} />Остановить ожидание</button>}
      </div>
      <p className="validation-hint">До шести вызовов модели и шестисот проверок плана. Провайдер — выбранный в панели AI. Внешние API могут тарифицировать запросы.</p>
      {!planValid && plan.measure_ids.length > 0 && <p className="validation-hint">Завершите допустимый план или сбросьте выбор, чтобы начать с нуля.</p>}
      {busy && <p role="status">Модель выбирает инструменты; сервер считает варианты. Обычно это занимает до минуты.</p>}
      {cancelled && <p role="status">Ожидание остановлено. Уже отправленный модели запрос мог продолжить выполняться.</p>}
      {error && !stale && <p className="validation-hint is-error" role="alert">{error}</p>}
      {proposal && <div className="agent-proposal">
        {stale && <p className="stale-banner" role="status">План, цель или провайдер изменены. Запустите агента заново.</p>}
        <h3>Проверенное предложение · {proposal.provider_used}</h3>
        <div className="agent-metrics">
          <span>Score <strong>{proposal.simulation.score.final}</strong></span>
          <span>Бюджет <strong>{proposal.simulation.budget.spent} / {proposal.simulation.budget.limit}</strong></span>
          <span>Остаток <strong>{proposal.simulation.budget.remaining}</strong></span>
          <span>Критических <strong>{proposal.simulation.score_breakdown.n_crit_final}</strong></span>
        </div>
        <p>К {proposal.comparison.reference === 'current_plan' ? 'вашему плану' : 'исходному состоянию'}:
          Score {formatDelta(proposal.comparison.score.delta)}; слабейший D {formatDelta(proposal.comparison.weakest_district.delta)};
          критических показателей {formatDelta(proposal.comparison.critical_metrics.delta)}.</p>
        <ul>{proposal.simulation.selected_measures.map((measure) => <li key={measure.id}>
          <strong>{measure.id} · {measure.name}</strong> — {measure.cost} у.е.;
          {' '}{measure.measure_type === 'City' ? 'весь город' : measure.target_districts.map((id) =>
            proposal.simulation.districts.find((district) => district.id === id)?.name ?? id).join(', ')}
        </li>)}</ul>
        <details><summary>Действия агента · {proposal.evaluated_plans} проверок / {proposal.valid_plans} допустимых</summary>
          <ol>{proposal.steps.map((step, index) => <li key={index}>{step.provider} · {step.tool} · {step.status}</li>)}</ol>
        </details>
        {[...proposal.warnings, ...proposal.simulation.warnings].map((warning) => <p className="validation-hint" key={warning}>{warning}</p>)}
        <button type="button" className="secondary-action" disabled={stale || busy || analysisBusy} onClick={() => {
          onApply(proposal.proposed_plan); setProposal(null);
        }}><Check size={16} />Применить предложенный план</button>
      </div>}
    </section>
  );
}
