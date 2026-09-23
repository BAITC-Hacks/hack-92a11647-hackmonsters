import type { Catalog, Plan } from "../types";

export const formatNumber = (value: number) =>
  value.toLocaleString("ru-RU", { maximumFractionDigits: 6 });
export const formatDelta = (value: number) =>
  `${value > 0 ? "+" : ""}${formatNumber(value)}`;
export const planKey = (plan: Plan) =>
  JSON.stringify([
    [...plan.measure_ids].sort(),
    Object.entries(plan.district_assignments).sort(([a], [b]) =>
      a.localeCompare(b),
    ),
  ]);

// Fast feedback while assembling a plan. The server revalidates every completed plan.
// No metric, penalty or Score calculations belong here.
export function selectionError(plan: Plan, catalog: Catalog): string | null {
  const measures = plan.measure_ids.map((id) =>
    catalog.dataset.measures.find((m) => m.id === id),
  );
  if (measures.some((m) => !m)) return "Неизвестная мера. Обновите каталог.";
  if (new Set(plan.measure_ids).size !== measures.length)
    return "Меры не должны повторяться.";
  if (measures.length > catalog.required_decisions)
    return `Можно выбрать только ${catalog.required_decisions} мер.`;
  if (measures.reduce((total, m) => total + m!.cost, 0) > catalog.budget_limit)
    return "Этот набор превышает бюджет.";
  const counts: Record<string, number> = {};
  for (const measure of measures) {
    if (!measure) continue;
    counts[measure.category] = (counts[measure.category] ?? 0) + 1;
    if (counts[measure.category] > catalog.max_per_category)
      return `В направлении «${measure.category}» допускается не более ${catalog.max_per_category} мер.`;
    const target = plan.district_assignments[measure.id];
    if (
      measure.measure_type === "District" &&
      !catalog.dataset.districts.some((d) => d.id === target)
    )
      return `Выберите район для «${measure.name}».`;
    if (measure.measure_type === "City" && target)
      return "Общегородская мера не требует выбора района.";
  }
  for (const conflict of catalog.dataset.conflicts) {
    const [a, b] = conflict.pair;
    if (
      plan.measure_ids.includes(a) &&
      plan.measure_ids.includes(b) &&
      (conflict.scope === "global" ||
        plan.district_assignments[a] === plan.district_assignments[b])
    ) {
      return `${a} и ${b} несовместимы${conflict.scope === "same_district" ? " в одном районе" : ""}.`;
    }
  }
  return null;
}
