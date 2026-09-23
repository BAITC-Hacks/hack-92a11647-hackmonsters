import { useState } from "react";
import { Check, Search, WandSparkles } from "lucide-react";
import { CATEGORY_COLORS } from "../data";
import { formatDelta } from "../lib/simulation";
import type { SelectionResult } from "../hooks/useSimulation";
import type { Catalog, Measure, Plan } from "../types";

interface Props {
  catalog: Catalog;
  plan: Plan;
  onSelect: (measure: Measure, district?: string) => SelectionResult;
  onAssign: (id: string, district: string) => SelectionResult;
  onNotice: (result: SelectionResult) => void;
  onExample: () => SelectionResult;
}
export function DecisionCatalog({
  catalog,
  plan,
  onSelect,
  onAssign,
  onNotice,
  onExample,
}: Props) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [targets, setTargets] = useState<Record<string, string>>({});
  const categories = [
    ...new Set(catalog.dataset.measures.map((m) => m.category)),
  ];
  const measures = catalog.dataset.measures.filter(
    (m) =>
      (filter === "all" || m.category === filter) &&
      `${m.id} ${m.name}`
        .toLocaleLowerCase("ru")
        .includes(query.toLocaleLowerCase("ru")),
  );
  return (
    <aside className="panel catalog-panel" aria-labelledby="catalog-title">
      <div className="panel-heading catalog-heading">
        <div>
          <p className="eyebrow">Библиотека решений</p>
          <div className="heading-line">
            <h1 id="catalog-title">Городские меры</h1>
            <span className="count-badge">
              {catalog.dataset.measures.length}
            </span>
          </div>
        </div>
      </div>
      <label className="search-field">
        <Search size={17} />
        <span className="sr-only">Поиск по мерам</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти меру"
        />
      </label>
      <div className="filter-row" aria-label="Направления мер">
        {["all", ...categories].map((category) => (
          <button
            key={category}
            type="button"
            className={`filter-pill${filter === category ? " is-active" : ""}`}
            aria-pressed={filter === category}
            onClick={() => setFilter(category)}
          >
            {category === "all" ? "Все" : category}
          </button>
        ))}
      </div>
      <div className="catalog-rule">
        Выберите {catalog.required_decisions} мер, не более{" "}
        {catalog.max_per_category} из одного направления.
      </div>
      <div className="measure-list" aria-label="Каталог мер">
        {measures.map((measure) => {
          const selected = plan.measure_ids.includes(measure.id);
          const district = selected
            ? (plan.district_assignments[measure.id] ?? "")
            : (targets[measure.id] ?? "");
          return (
            <article
              key={measure.id}
              className={`measure-card${selected ? " is-selected" : ""}`}
              style={
                {
                  "--direction-color":
                    CATEGORY_COLORS[
                      categories.indexOf(measure.category) %
                        CATEGORY_COLORS.length
                    ],
                } as React.CSSProperties
              }
            >
              <div className="measure-card__meta">
                <span className="direction-label">
                  <span className="direction-dot" />
                  {measure.category}
                </span>
                <span className="measure-badge">{measure.id}</span>
              </div>
              <div className="measure-card__title-row">
                <h2>{measure.name}</h2>
                <span className="measure-cost">
                  {measure.cost}
                  <small>у.е.</small>
                </span>
              </div>
              <p>
                {measure.measure_type === "City"
                  ? "Все районы"
                  : "Один выбранный район"}{" "}
                · Лаг: {measure.lag} кв.
              </p>
              {measure.measure_type === "District" && (
                <label className="district-select">
                  Район для {measure.id}
                  <select
                    value={district}
                    aria-label={`Район для ${measure.id}`}
                    onChange={(e) => {
                      if (selected)
                        onNotice(onAssign(measure.id, e.target.value));
                      else
                        setTargets((current) => ({
                          ...current,
                          [measure.id]: e.target.value,
                        }));
                    }}
                  >
                    <option value="">Выберите район</option>
                    {catalog.dataset.districts.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="impact-chips" aria-label="Эффекты до учёта лага">
                {Object.entries(measure.effects).map(([metric, value]) => (
                  <span key={metric} title={catalog.metric_labels[metric]}>
                    {metric} {formatDelta(value)}
                  </span>
                ))}
              </div>
              <div className="measure-card__footer">
                <small>Эффекты до учёта лага</small>
                <button
                  type="button"
                  className="measure-action"
                  aria-pressed={selected}
                  onClick={() => onNotice(onSelect(measure, district))}
                >
                  {selected ? (
                    <>
                      <Check size={15} /> Убрать
                    </>
                  ) : (
                    "Добавить"
                  )}
                </button>
              </div>
            </article>
          );
        })}
        {!measures.length && <p className="empty-search">Меры не найдены.</p>}
      </div>
      <button
        type="button"
        className="balanced-plan-button"
        onClick={() => onNotice(onExample())}
      >
        <WandSparkles size={16} />
        Загрузить план из задания
      </button>
    </aside>
  );
}
