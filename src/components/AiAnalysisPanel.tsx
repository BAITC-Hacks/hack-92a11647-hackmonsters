import {
  Bot,
  FileText,
  Pause,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { AnalysisStatus, Assessment } from "../types";

interface Props {
  canAnalyze: boolean;
  status: AnalysisStatus;
  assessment?: Assessment;
  error: string;
  isStale: boolean;
  aiAvailable: boolean;
  onAnalyze: () => void;
  onCancel: () => void;
  onGeneratePitch: () => void;
}
export function AiAnalysisPanel({
  canAnalyze,
  status,
  assessment,
  error,
  isStale,
  aiAvailable,
  onAnalyze,
  onCancel,
  onGeneratePitch,
}: Props) {
  return (
    <aside className="panel ai-panel" aria-labelledby="ai-title">
      <div className="ai-panel__header">
        <div className="ai-identity">
          <span className="ai-orb">
            <Sparkles size={18} />
          </span>
          <div>
            <p className="eyebrow">Городской советник · OpenAI</p>
            <h2 id="ai-title">AI-аналитика</h2>
          </div>
        </div>
        <span className={`stream-status status-${status}`}>
          <i />
          {status === "loading"
            ? "анализ"
            : status === "complete"
              ? "готово"
              : status === "error"
                ? "ошибка"
                : "ожидает"}
        </span>
      </div>
      <div className="ai-security-note">
        <ShieldCheck size={15} />
        <span>AI объясняет рассчитанный сервером результат</span>
      </div>
      {!aiAvailable && (
        <p className="stale-banner">
          AI пока не настроен на сервере. Расчёт показателей доступен.
        </p>
      )}
      {isStale && assessment && (
        <div className="stale-banner" role="status">
          План изменён. Анализ ниже относится к предыдущему плану — запустите
          новый.
        </div>
      )}
      <div className="analysis-content" aria-busy={status === "loading"}>
        {!assessment && status === "idle" && (
          <div className="analysis-empty">
            <Bot size={30} />
            <h3>Сценарий ещё не отправлен</h3>
            <p>Соберите план, дождитесь расчёта и запустите AI-анализ.</p>
          </div>
        )}
        {status === "loading" && (
          <p className="validation-hint" role="status">
            OpenAI формирует объяснение. Ответ появится после проверки формата и
            числовых ссылок.
          </p>
        )}
        {assessment && (
          <article className="markdown-output">
            <h3>Общая оценка</h3>
            <p>{assessment.general_assessment}</p>
            {(
              [
                ["Сильные стороны", assessment.strengths],
                ["Риски и штрафы", assessment.risks_and_penalties],
                ["Рекомендации", assessment.recommendations],
              ] as const
            ).map(([title, items]) => (
              <section key={title}>
                <h3>{title}</h3>
                {items.length ? (
                  <ul>
                    {items.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p>Подтверждённые пункты не указаны.</p>
                )}
              </section>
            ))}
          </article>
        )}
        {status === "error" && (
          <div className="analysis-error" role="alert">
            <div>
              <strong>Анализ недоступен</strong>
              <p>{error}</p>
            </div>
          </div>
        )}
        {status === "cancelled" && (
          <p role="status">Анализ остановлен. Можно запустить новый.</p>
        )}
      </div>
      <div className="ai-panel__actions">
        {status === "loading" ? (
          <button type="button" className="secondary-action" onClick={onCancel}>
            <Pause size={16} />
            Остановить
          </button>
        ) : (
          <button
            type="button"
            className="secondary-action"
            disabled={!canAnalyze}
            onClick={onAnalyze}
          >
            <RefreshCw size={16} />
            {assessment ? "Обновить анализ" : "Анализировать"}
          </button>
        )}
      </div>
      <button
        type="button"
        className="pitch-button"
        disabled={status !== "complete" || isStale || !assessment}
        onClick={onGeneratePitch}
      >
        <FileText size={18} />
        <span>
          <strong>Собрать питч</strong>
          <small>Слайды из расчёта и AI-анализа</small>
        </span>
      </button>
    </aside>
  );
}
