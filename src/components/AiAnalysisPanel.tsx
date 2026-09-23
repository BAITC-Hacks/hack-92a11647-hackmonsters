import { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Check,
  Clipboard,
  FileText,
  Pause,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import Markdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import type { AnalysisProvider, StreamStatus } from '../types';

interface AiAnalysisPanelProps {
  canAnalyze: boolean;
  status: StreamStatus;
  markdown: string;
  error: string;
  provider: AnalysisProvider;
  providerUsed: string;
  isStale: boolean;
  pitchLoading: boolean;
  onProviderChange: (provider: AnalysisProvider) => void;
  onAnalyze: () => void;
  onCancel: () => void;
  onGeneratePitch: () => void;
}

const PROVIDERS: { id: AnalysisProvider; label: string; short: string }[] = [
  { id: 'auto', label: 'OpenAI → NVIDIA при ошибке; иначе доступный провайдер', short: 'Авто' },
  { id: 'openai', label: 'OpenAI', short: 'OAI' },
  { id: 'nvidia', label: 'NVIDIA NIM', short: 'NIM' },
];

export function AiAnalysisPanel({
  canAnalyze,
  status,
  markdown,
  error,
  provider,
  providerUsed,
  isStale,
  pitchLoading,
  onProviderChange,
  onAnalyze,
  onCancel,
  onGeneratePitch,
}: AiAnalysisPanelProps) {
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    if (status !== 'streaming' || !autoScrollRef.current) return;
    contentRef.current?.scrollTo({
      top: contentRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [markdown, status]);

  const handleScroll = () => {
    const element = contentRef.current;
    if (!element) return;
    autoScrollRef.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 64;
  };

  const copy = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const providerLabel = PROVIDERS.find((item) => item.id === provider)?.label;
  const hasResult = Boolean(markdown);

  return (
    <aside className="panel ai-panel" aria-labelledby="ai-title">
      <div className="ai-panel__header">
        <div className="ai-identity">
          <span className="ai-orb" aria-hidden="true">
            <Sparkles size={18} />
          </span>
          <div>
            <p className="eyebrow">Городской советник</p>
            <h2 id="ai-title">AI-аналитика</h2>
          </div>
        </div>
        <span className={`stream-status status-${status}`}>
          <i aria-hidden="true" />
          {status === 'streaming'
            ? 'анализ'
            : status === 'complete'
              ? 'готово'
              : status === 'error'
                ? 'ошибка'
                : 'ожидает'}
        </span>
      </div>

      <fieldset className="provider-switch" disabled={status === 'streaming'}>
        <legend className="sr-only">Выберите AI-провайдера</legend>
        {PROVIDERS.map((item) => (
          <label
            key={item.id}
            className={provider === item.id ? 'is-selected' : ''}
            title={item.label}
          >
            <input
              type="radio"
              name="provider"
              value={item.id}
              checked={provider === item.id}
              onChange={() => onProviderChange(item.id)}
            />
            <span>{item.short}</span>
          </label>
        ))}
        <p>{providerLabel}</p>
      </fieldset>

      <div className="ai-security-note">
        <ShieldCheck size={15} aria-hidden="true" />
        <span>{providerUsed ? `Ответил: ${providerUsed}. ` : ''}Ключи остаются на backend</span>
      </div>

      {isStale && hasResult && (
        <div className="stale-banner" role="status">
          <TriangleAlert size={16} aria-hidden="true" />
          План изменён. Текст ниже относится к предыдущему набору решений.
        </div>
      )}

      <div
        className="analysis-content"
        ref={contentRef}
        onScroll={handleScroll}
        aria-busy={status === 'streaming'}
      >
        {!hasResult && status === 'idle' && (
          <div className="analysis-empty">
            <div className="analysis-empty__visual" aria-hidden="true">
              <span className="orbit orbit-one" />
              <span className="orbit orbit-two" />
              <Bot size={30} />
            </div>
            <h3>Сценарий ещё не отправлен</h3>
            <p>
              Соберите пять решений — AI объяснит влияние, риски и компромиссы.
            </p>
            <ul>
              <li><Check size={14} /> Сильные стороны</li>
              <li><Check size={14} /> Риски и последствия</li>
              <li><Check size={14} /> Практические рекомендации</li>
            </ul>
          </div>
        )}

        {!hasResult && status === 'streaming' && (
          <div className="analysis-skeleton" aria-label="AI начинает анализ">
            <span />
            <span />
            <span />
            <span />
          </div>
        )}

        {hasResult && (
          <article className="markdown-output">
            <Markdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeSanitize]}
              skipHtml
              components={{
                a: ({ ...props }) => (
                  <a {...props} target="_blank" rel="noopener noreferrer" />
                ),
              }}
            >
              {markdown}
            </Markdown>
            {status === 'streaming' && <span className="stream-cursor" aria-hidden="true" />}
          </article>
        )}

        {status === 'error' && (
          <div className="analysis-error" role="alert">
            <TriangleAlert size={20} aria-hidden="true" />
            <div>
              <strong>Анализ прерван</strong>
              <p>{error}</p>
            </div>
          </div>
        )}
      </div>

      <div className="stream-announcer" role="status" aria-live="polite">
        {status === 'streaming'
          ? 'AI формирует анализ.'
          : status === 'complete'
            ? 'Анализ завершён.'
            : status === 'cancelled'
              ? 'Генерация остановлена.'
              : ''}
      </div>

      <div className="ai-panel__actions">
        {status === 'streaming' ? (
          <button type="button" className="secondary-action" onClick={onCancel}>
            <Pause size={16} aria-hidden="true" /> Остановить
          </button>
        ) : (
          <button
            type="button"
            className="secondary-action"
            disabled={!canAnalyze}
            onClick={onAnalyze}
          >
            <RefreshCw size={16} aria-hidden="true" />
            {hasResult ? 'Обновить' : 'Анализировать'}
          </button>
        )}
        <button
          type="button"
          className="icon-button labeled"
          disabled={!hasResult}
          onClick={copy}
        >
          {copied ? <Check size={15} /> : <Clipboard size={15} />}
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>

      <button
        type="button"
        className="pitch-button"
        disabled={!canAnalyze || pitchLoading}
        onClick={onGeneratePitch}
      >
        <span className="pitch-button__icon">
          <FileText size={18} aria-hidden="true" />
        </span>
        <span>
          <strong>{pitchLoading ? 'Собираем слайды…' : 'Собрать слайды расчёта'}</strong>
          <small>4 слайда по шаблону · без выдуманных AI-фактов</small>
        </span>
        <Sparkles size={17} aria-hidden="true" />
      </button>
    </aside>
  );
}
