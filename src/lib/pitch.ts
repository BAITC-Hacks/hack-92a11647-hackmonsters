import type { AnalysisResponse, PitchSlideData } from "../types";
import { formatDelta, formatNumber } from "./simulation";

// Deterministic presentation of the validated analysis, with no second AI request.
export function buildPitchSlides({
  simulation: result,
  assessment,
}: AnalysisResponse): PitchSlideData[] {
  return [
    {
      id: "plan",
      eyebrow: "План",
      title: "Решения для Астаны",
      tone: "ink",
      bullets: result.selected_measures.map(
        (m) =>
          `${m.id} · ${m.name} — ${m.measure_type === "City" ? "весь город" : m.target_districts.map((id) => result.districts.find((d) => d.id === id)?.name ?? id).join(", ")}`,
      ),
      metrics: [
        { label: "Расходы", value: `${result.budget.spent} у.е.` },
        { label: "Остаток", value: `${result.budget.remaining} у.е.` },
      ],
      speakerNotes:
        "Стоимость, назначения и ограничения проверены серверным калькулятором.",
    },
    {
      id: "effect",
      eyebrow: "Результат калькулятора",
      title: "Как изменятся показатели",
      tone: "mint",
      bullets: [assessment.general_assessment, ...assessment.strengths],
      metrics: [
        { label: "Score", value: formatNumber(result.score.final) },
        { label: "Изменение Score", value: formatDelta(result.score.delta) },
      ],
      speakerNotes: `Исходный Score: ${formatNumber(result.score.base)}. Горизонт: ${result.methodology.horizon_periods} кв.`,
    },
    {
      id: "risks",
      eyebrow: "Риски и ограничения",
      title: "Что требует внимания",
      tone: "amber",
      bullets: assessment.risks_and_penalties.length
        ? assessment.risks_and_penalties
        : ["Подтверждённые риски в анализе не указаны."],
      metrics: [
        {
          label: "Штраф после мер",
          value: formatNumber(result.score_breakdown.critical_penalty.final),
        },
        {
          label: "Критические показатели",
          value: String(result.score_breakdown.n_crit_final),
        },
      ],
      speakerNotes:
        "Отделяйте применённые штрафы калькулятора от качественных рисков AI.",
    },
    {
      id: "next",
      eyebrow: "Следующие шаги",
      title: "Рекомендации для нового сценария",
      tone: "blue",
      bullets: assessment.recommendations.length
        ? assessment.recommendations
        : ["Дополнительные рекомендации не указаны."],
      speakerNotes:
        "Изменённый набор мер нужно повторно проверить калькулятором; рекомендации не гарантируют числовой эффект.",
    },
  ];
}
