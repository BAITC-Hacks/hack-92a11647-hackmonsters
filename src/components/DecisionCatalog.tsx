import { useMemo, useState } from 'react';
import { ArrowDownUp, Check, Gauge, Search, WandSparkles } from 'lucide-react';
import { categoryColor } from '../data';
import type { SelectionResult } from '../hooks/useSimulation';
import { formatDelta } from '../lib/simulation';
import type { Catalog, Measure } from '../types';

interface Props {
  catalog: Catalog;
  selectedMeasures: Measure[];
  onSelect: (measure: Measure) => SelectionResult;
  onNotice: (message: string, tone: 'success' | 'error') => void;
  onExample: () => void;
}

export function DecisionCatalog({ catalog, selectedMeasures, onSelect, onNotice, onExample }: Props) {
  const [filter, setFilter] = useState('Все');
  const [query, setQuery] = useState('');
  const [sortCost, setSortCost] = useState(false);
  const categories = [...new Set(catalog.dataset.measures.map((measure) => measure.category))];
  const visibleMeasures = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru');
    const filtered = catalog.dataset.measures.filter((measure) =>
      (filter === 'Все' || measure.category === filter)
      && `${measure.id} ${measure.name}`.toLocaleLowerCase('ru').includes(normalized));
    return sortCost ? [...filtered].sort((first, second) => first.cost - second.cost) : filtered;
  }, [catalog, filter, query, sortCost]);

  return (
    <aside className="panel catalog-panel" aria-labelledby="catalog-title">
      <div className="panel-heading catalog-heading">
        <div><p className="eyebrow">Единый серверный каталог</p>
          <div className="heading-line"><h1 id="catalog-title">Городские меры</h1><span className="count-badge">{catalog.dataset.measures.length}</span></div>
        </div>
        <button className="icon-button" type="button" aria-label="Сортировать по стоимости" onClick={() => setSortCost(!sortCost)}><ArrowDownUp size={17} /></button>
      </div>
      <label className="search-field"><Search size={17} /><span className="sr-only">Поиск по мерам</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Название или ID меры" />
      </label>
      <div className="filter-row" role="tablist" aria-label="Направления мер">
        {['Все', ...categories].map((category) => (
          <button key={category} type="button" role="tab" aria-selected={filter === category}
            className={filter === category ? 'filter-pill is-active' : 'filter-pill'} onClick={() => setFilter(category)}>{category}</button>
        ))}
      </div>
      <div className="catalog-rule"><Gauge size={16} /><span>Ровно {catalog.required_decisions} мер; максимум {catalog.max_per_category} из одного направления</span></div>
      <div className="measure-list" aria-label="Каталог мер">
        {visibleMeasures.map((measure) => {
          const selected = selectedMeasures.some((item) => item.id === measure.id);
          return (
            <article key={measure.id} className={`measure-card${selected ? ' is-selected' : ''}`}
              style={{ '--direction-color': categoryColor(measure.category) } as React.CSSProperties}>
              <div className="measure-card__meta"><span className="direction-label"><span className="direction-dot" />{measure.category}</span><span className="measure-badge">{measure.id}</span></div>
              <div className="measure-card__title-row"><h2>{measure.name}</h2><span className="measure-cost">{measure.cost}<small>у.е.</small></span></div>
              <p>{measure.measure_type === 'City' ? 'Весь город' : 'Один выбранный район'} · Лаг {measure.lag} ({catalog.methodology.period_unit})</p>
              <div className="measure-card__footer">
                <div className="impact-chips" aria-label="Эффекты до применения лага">
                  {Object.entries(measure.effects).map(([metric, value]) => <span key={metric}>{metric} {formatDelta(value)}</span>)}
                </div>
                <button type="button" className="measure-action" aria-pressed={selected} onClick={() => {
                  const response = onSelect(measure);
                  onNotice(response.message, response.ok ? 'success' : 'error');
                }}>{selected ? <><Check size={15} /> Убрать</> : 'Добавить'}</button>
              </div>
            </article>
          );
        })}
        {!visibleMeasures.length && <p className="empty-search">Меры не найдены.</p>}
      </div>
      <button type="button" className="balanced-plan-button" onClick={onExample}><WandSparkles size={16} />Загрузить контрольный пример</button>
    </aside>
  );
}
