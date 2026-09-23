import { useMemo, useState } from 'react';
import {
  ArrowDownUp,
  Check,
  ChevronRight,
  Gauge,
  Search,
  WandSparkles,
} from 'lucide-react';
import { BUDGET_LIMIT, DIRECTIONS, MEASURES, REQUIRED_DECISIONS } from '../data';
import type { SelectionResult } from '../hooks/useSimulation';
import { formatDelta } from '../lib/simulation';
import type { Direction, Measure } from '../types';

type Filter = 'all' | Direction;

interface DecisionCatalogProps {
  selectedMeasures: Measure[];
  spent: number;
  onSelect: (measure: Measure) => SelectionResult;
  onNotice: (message: string, tone: 'success' | 'error') => void;
  onBalancedPlan: () => void;
}

export function DecisionCatalog({
  selectedMeasures,
  spent,
  onSelect,
  onNotice,
  onBalancedPlan,
}: DecisionCatalogProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'cost'>('default');

  const visibleMeasures = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru');
    const filtered = MEASURES.filter((measure) => {
      const matchesDirection = filter === 'all' || measure.direction === filter;
      const matchesQuery =
        !normalized ||
        `${measure.title} ${measure.description}`
          .toLocaleLowerCase('ru')
          .includes(normalized);
      return matchesDirection && matchesQuery;
    });

    if (sortBy === 'cost') return [...filtered].sort((a, b) => a.cost - b.cost);
    return filtered;
  }, [filter, query, sortBy]);

  const handleSelect = (measure: Measure) => {
    const result = onSelect(measure);
    onNotice(result.message, result.ok ? 'success' : 'error');
  };

  return (
    <aside className="panel catalog-panel" aria-labelledby="catalog-title">
      <div className="panel-heading catalog-heading">
        <div>
          <p className="eyebrow">Библиотека решений</p>
          <div className="heading-line">
            <h1 id="catalog-title">14 городских мер</h1>
            <span className="count-badge">{MEASURES.length}</span>
          </div>
        </div>
        <button
          className="icon-button"
          type="button"
          title={sortBy === 'cost' ? 'Вернуть исходный порядок' : 'Сортировать по стоимости'}
          aria-label={sortBy === 'cost' ? 'Вернуть исходный порядок' : 'Сортировать по стоимости'}
          onClick={() => setSortBy((current) => (current === 'cost' ? 'default' : 'cost'))}
        >
          <ArrowDownUp size={17} aria-hidden="true" />
        </button>
      </div>

      <label className="search-field">
        <Search size={17} aria-hidden="true" />
        <span className="sr-only">Поиск по мерам</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Найти меру"
        />
        <kbd>⌘ K</kbd>
      </label>

      <div className="filter-row" role="tablist" aria-label="Направления мер">
        <button
          type="button"
          role="tab"
          aria-selected={filter === 'all'}
          className={filter === 'all' ? 'filter-pill is-active' : 'filter-pill'}
          onClick={() => setFilter('all')}
        >
          Все
        </button>
        {DIRECTIONS.map((direction) => (
          <button
            key={direction.id}
            type="button"
            role="tab"
            aria-selected={filter === direction.id}
            className={filter === direction.id ? 'filter-pill is-active' : 'filter-pill'}
            onClick={() => setFilter(direction.id)}
            title={direction.fullLabel}
          >
            {direction.shortLabel}
          </button>
        ))}
      </div>

      <div className="catalog-rule">
        <Gauge size={16} aria-hidden="true" />
        <span>Выберите по одной мере из каждого направления</span>
      </div>

      <div className="measure-list" aria-label="Каталог мер">
        {visibleMeasures.map((measure) => {
          const direction = DIRECTIONS.find((item) => item.id === measure.direction)!;
          const selected = selectedMeasures.some((item) => item.id === measure.id);
          const sameDirection = selectedMeasures.find(
            (item) => item.direction === measure.direction,
          );
          const nextSpent = spent - (sameDirection?.cost ?? 0) + measure.cost;
          const budgetBlocked = !selected && nextSpent > BUDGET_LIMIT;
          const slotsBlocked =
            !selected &&
            !sameDirection &&
            selectedMeasures.length >= REQUIRED_DECISIONS;
          const blocked = budgetBlocked || slotsBlocked;
          const strongestImpact = Object.entries(measure.impact)
            .filter(([, value]) => value !== 0)
            .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
            .slice(0, 2);

          return (
            <article
              key={measure.id}
              className={`measure-card${selected ? ' is-selected' : ''}${blocked ? ' is-blocked' : ''}`}
              style={{ '--direction-color': direction.color } as React.CSSProperties}
            >
              <div className="measure-card__meta">
                <span className="direction-label">
                  <span className="direction-dot" aria-hidden="true" />
                  {direction.label}
                </span>
                {measure.badge && <span className="measure-badge">{measure.badge}</span>}
              </div>
              <div className="measure-card__title-row">
                <h2>{measure.title}</h2>
                <span className="measure-cost">
                  {measure.cost}
                  <small>у.е.</small>
                </span>
              </div>
              <p>{measure.description}</p>
              <div className="measure-card__footer">
                <div className="impact-chips" aria-label="Главные ожидаемые эффекты">
                  {strongestImpact.map(([key, value]) => {
                    const meta = DIRECTIONS.find((item) => item.id === key);
                    return (
                      <span key={key} title={meta?.fullLabel}>
                        {meta?.shortLabel} {formatDelta(value)}
                      </span>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="measure-action"
                  aria-pressed={selected}
                  aria-disabled={blocked}
                  title={
                    budgetBlocked
                      ? `Не хватает ${nextSpent - BUDGET_LIMIT} у.е.`
                      : slotsBlocked
                        ? 'Все 5 слотов заняты'
                        : undefined
                  }
                  onClick={() => handleSelect(measure)}
                >
                  {selected ? (
                    <>
                      <Check size={15} aria-hidden="true" /> Выбрано
                    </>
                  ) : budgetBlocked ? (
                    `−${nextSpent - BUDGET_LIMIT} у.е.`
                  ) : sameDirection ? (
                    <>
                      Заменить <ChevronRight size={15} aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      Добавить <ChevronRight size={15} aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            </article>
          );
        })}
        {!visibleMeasures.length && (
          <div className="empty-search">
            <Search size={22} aria-hidden="true" />
            <p>По этому запросу мер не найдено.</p>
          </div>
        )}
      </div>

      <button
        type="button"
        className="balanced-plan-button"
        onClick={() => {
          onBalancedPlan();
          onNotice('Собран сбалансированный демо-план на 78 у.е.', 'success');
        }}
      >
        <WandSparkles size={16} aria-hidden="true" />
        Собрать сбалансированный план
      </button>
    </aside>
  );
}
