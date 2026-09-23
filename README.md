# Аким на 5 часов

Рабочий React-прототип AI-симулятора управления Астаной. Команда выбирает ровно пять городских мер, удерживает единый виртуальный бюджет в пределах 100 у.е., сравнивает предварительный эффект для пяти районов и получает потоковый AI-разбор с коротким питчем для жюри.

Проект сделан как frontend-first демо: по умолчанию аналитика и питч генерируются локальным mock-адаптером, поэтому основной сценарий воспроизводится без API-ключей и backend. Для интеграции достаточно включить API-режим и реализовать два описанных ниже endpoint.

## Важное уточнение требований

Исходный DOCX подтверждает единый ограниченный бюджет, пять решений по пяти направлениям, автоматический запрет перерасхода, AI-анализ, Astana Quality of Life Score, объяснение сильных сторон, рисков и компромиссов, а также опциональную краткую презентацию.

Три числовых параметра взяты из продуктового задания пользователя, а не из DOCX:

- каталог из 14 мер;
- лимит 100 у.е.;
- пять районов.

Число 100 на третьей странице DOCX относится к сумме баллов жюри, не к бюджету симулятора. В интерфейсе 100 у.е. зафиксированы именно как продуктовое правило текущего прототипа.

## Что реализовано

- Каталог из 14 мер с поиском, фильтрами, сортировкой, стоимостью, ожидаемыми эффектами и риском внедрения.
- Пять слотов — по одному на каждое направление: транспорт, экология, соцсфера, безопасность, сервисы.
- Безопасная замена меры внутри направления без промежуточного удаления.
- Жёсткая проверка `spent <= 100`; недоступный выбор объясняет дефицит бюджета.
- Budget meter с порогом внимания на 80% и точным остатком.
- Предварительный расчёт `baseline → projected → delta` для пяти районов.
- Recharts radar chart для выбранного района и HTML-матрица 5×5 для точного сравнения всех дельт.
- Панель AI-аналитики с переключением OpenAI, NVIDIA NIM и consensus-режима.
- Потоковый Markdown через `fetch POST + ReadableStream`, `AbortController`, отмену, повторный запуск и признак устаревшего результата.
- Безопасный рендеринг Markdown через `react-markdown`, `remark-gfm` и `rehype-sanitize` без `rehype-raw`.
- Кнопка «Сгенерировать питч» и адаптивная карусель из четырёх слайдов с клавиатурной навигацией, swipe, заметками спикера и печатью.
- Desktop, tablet и mobile layouts, reduced-motion режим и основные ARIA-состояния.

## Запуск

Требуется Node.js `^20.19.0` или `>=22.12.0` и pnpm.

```bash
pnpm install
pnpm dev
```

Production-проверка:

```bash
pnpm typecheck
pnpm build
pnpm preview
```

Mock-режим включён по умолчанию. Для backend-интеграции скопируйте `.env.example` в `.env.local` и измените:

```dotenv
VITE_ANALYSIS_MODE=api
```

Ключи OpenAI и NVIDIA не должны иметь префикс `VITE_` и не должны попадать во frontend. Они хранятся только в server-side environment/secret manager.

## Стек

- React 19 + TypeScript 7 + Vite 8;
- Recharts 3.10 для radar chart;
- react-markdown 10, remark-gfm и rehype-sanitize;
- Lucide React для интерфейсных иконок;
- CSS без UI-фреймворка — дизайн-система и responsive layout находятся в одном слое.

Выбор Recharts опирается на composable React API, SVG-рендеринг, `ResponsiveContainer`, типизацию и встроенный accessibility layer. Для Vue-версии ближайшая замена — Apache ECharts с `series.type = "radar"`.

## Компонентная архитектура

```text
App
├── TopBar
├── DecisionCatalog
│   ├── search and direction filters
│   ├── 14 MeasureCard items
│   └── balanced demo plan action
├── workspace
│   ├── PlanDock
│   │   ├── 5 DecisionSlot items
│   │   ├── BudgetMeter
│   │   └── Analyze CTA
│   └── ImpactDashboard
│       ├── DistrictTabs
│       ├── RadarChart
│       └── ImpactMatrix 5 × 5
├── AiAnalysisPanel
│   ├── ProviderSwitch
│   ├── MarkdownStream
│   └── AnalysisActions
└── PitchCarousel
    ├── PitchSlide
    ├── CarouselControls
    └── SpeakerNotes
```

Ключевые файлы:

| Файл | Ответственность |
|---|---|
| `src/data.ts` | 14 мер, пять районов, baseline, sensitivity, направления и лимиты |
| `src/hooks/useSimulation.ts` | выбранные меры, бюджет, замена, пять слотов, готовность к анализу |
| `src/lib/simulation.ts` | расчёт projected metrics, district/city scores и дельт |
| `src/components/DecisionCatalog.tsx` | каталог, поиск, фильтры и состояния карточек |
| `src/components/PlanDock.tsx` | корзина решений, budget meter и CTA |
| `src/components/ImpactDashboard.tsx` | radar chart, районные tabs и матрица 5×5 |
| `src/services/analysisStream.ts` | mock-stream и production SSE parser |
| `src/hooks/useAnalysisStream.ts` | буферизация дельт, status, cancel и plan version |
| `src/components/AiAnalysisPanel.tsx` | provider UI, Markdown и streaming UX |
| `src/services/pitchService.ts` | API/mock transport и runtime-проверка 3–4 слайдов |
| `src/components/PitchCarousel.tsx` | modal-карусель и презентационный режим |

## Правила корзины и бюджета

Текущая продуктовая конфигурация требует ровно одного решения из каждого направления. Это снимает неоднозначность исходного ТЗ и гарантирует, что все пять осей получат осознанное решение.

При выборе второй меры того же направления старая мера заменяется атомарно:

```ts
nextSpent = spent - currentDirectionMeasure.cost + candidate.cost;
```

Изменение принимается только при выполнении всех инвариантов:

```ts
nextSpent <= 100;
selectedMeasures.length <= 5;
uniqueDirections.size === selectedMeasures.length;
```

Анализ доступен только когда:

```ts
selectedMeasures.length === 5 &&
spent <= 100 &&
allFiveDirectionsAreCovered;
```

Эти проверки должны быть повторены на backend. Frontend нельзя считать авторитетным источником стоимости или правил сценария.

## Логика визуализации

Для каждого района хранится исходный нормализованный вектор по шкале `0…100`:

```ts
type ScoreVector = Record<
  'transport' | 'ecology' | 'social' | 'safety' | 'services',
  number
>;
```

Предварительный preview рассчитывается так:

```ts
delta = round(sum(measureImpact * coverageFactor * districtSensitivity));
projected = clamp(baseline + delta, 0, 100);
districtScore = average(projectedAcrossFiveDirections);
cityScore = average(districtScores);
```

LLM не является источником чисел. После появления backend-модели авторитетные `baseline`, `projected`, `delta` и `Astana Quality of Life Score` должны приходить отдельным структурированным событием; LLM только объясняет результат.

### Почему не пять полигонов на одном radar chart

Пять районов × пять осей дают визуальный шум и плохо читаются на мобильном. Поэтому интерфейс использует два взаимодополняющих представления:

1. Radar «до / после» для одного выбранного района.
2. Точную HTML-матрицу район × направление для всех 25 дельт.

Цвет в матрице не является единственным носителем смысла: каждая ячейка содержит знак, число и стрелку, а `title` показывает `baseline → projected`.

### Предлагаемый reusable API radar chart

```ts
interface RadarAxisDatum {
  direction: Direction;
  label: string;
  baseline: number;
  projected: number;
  delta: number;
}

interface DistrictRadarProps {
  districtId: DistrictId;
  districtLabel: string;
  data: RadarAxisDatum[];
  domain?: readonly [number, number]; // default [0, 100]
  height?: number;                    // default 320
  showBaseline?: boolean;             // default true
  showProjected?: boolean;            // default true
  loading?: boolean;
  selectedDirection?: Direction;
  onDirectionSelect?: (direction: Direction) => void;
}
```

Во всех районах применяется единый domain `[0, 100]`; иначе визуальное сравнение будет вводить в заблуждение. Baseline — нейтральная пунктирная линия, projected — акцентная сплошная область.

## AI streaming

Основной transport — `fetch POST + ReadableStream`: сценарию нужен JSON body, выбранный provider и `AbortController`. Нативный `EventSource` не позволяет отправить POST body и произвольные headers.

### Запрос

```http
POST /api/ai/analysis/stream
Content-Type: application/json
Accept: text/event-stream
```

```json
{
  "decisionIds": ["id-1", "id-2", "id-3", "id-4", "id-5"],
  "provider": "consensus",
  "locale": "ru-KZ",
  "budgetLimit": 100
}
```

### Ответ

```text
event: meta
data: {"requestId":"run_123","provider":"openai"}

event: delta
data: {"text":"## Сильные стороны\n"}

event: delta
data: {"text":"- Снижение транспортной нагрузки..."}

event: done
data: {"finishReason":"stop"}
```

После начала `200 OK` сервер уже не может изменить HTTP status, поэтому runtime-ошибка передаётся отдельным событием:

```text
event: error
data: {"code":"UPSTREAM_TIMEOUT","message":"Провайдер не ответил","retryable":true}
```

Production response headers:

```http
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
X-Accel-Buffering: no
```

Парсер сохраняет хвост между network chunks: граница `reader.read()` не совпадает с границей SSE event. При размонтировании, изменении плана или нажатии «Остановить» активный `AbortController` отменяется. Старый готовый текст не исчезает при изменении корзины, а помечается как устаревший.

Markdown всегда перерисовывается из полного накопленного буфера. Курсор — отдельный DOM-элемент, чтобы не ломать незакрытые `**`, таблицы или code fences. Screen reader получает только редкие status-сообщения, а не каждый токен.

## Генерация питча

`POST /api/ai/pitch` получает пять решений и итоговый analysis Markdown. Backend должен вернуть структурированный deck, а не свободный текст:

```ts
interface PitchDeck {
  slides: PitchSlideData[]; // min 3, max 4
}

interface PitchSlideData {
  id: string;
  eyebrow: string;
  title: string;
  bullets: string[];
  metrics?: Array<{ label: string; value: string; delta?: number }>;
  speakerNotes: string;
  tone: 'ink' | 'mint' | 'amber' | 'blue';
}
```

Frontend валидирует количество и обязательные поля. Рекомендуемая история из четырёх слайдов:

1. Исходная ситуация и цель.
2. Пять решений и бюджет.
3. Изменения по районам и Quality of Life Score.
4. Риски, компромиссы и следующий шаг.

Карусель поддерживает `ArrowLeft`, `ArrowRight`, `Home`, `End`, touch swipe, точки прогресса, заметки спикера и печать. На мобильном она превращается в полноэкранный режим.

## Backend boundary

Frontend вызывает только собственные `/api/ai/...`. На backend остаются:

- OpenAI/NVIDIA API keys;
- выбор модели и provider fallback;
- rate limits, retries и timeout;
- проверка цен и ровно пяти решений;
- расчёт структурированных метрик;
- нормализация provider-specific stream в единые события;
- аудит и сохранение run history.

Если нужен автоматический reconnect, используйте двухшаговый transport:

1. `POST /api/ai/analysis-jobs` → `{ jobId, shortLivedStreamToken }`.
2. `EventSource(GET /api/ai/analysis-jobs/:jobId/events)` с `id:` и resume по `Last-Event-ID`.

Нельзя передавать provider API key в query string или браузерный JavaScript.

## Проверенный сценарий

Вручную проверены:

- desktop 1600×1000 и mobile 390×844;
- отсутствие горизонтального overflow на mobile;
- добавление и замена мер;
- состояние 5/5 и разблокировка CTA;
- комбинация на 96/100 и блокировка меры, которая дала бы 102/100;
- потоковый status, Markdown-разделы и завершение;
- stale state при изменении плана;
- открытие карусели, четыре слайда и переход между ними;
- mobile-питч в полноэкранном режиме;
- TypeScript и production build.

Для следующего этапа стоит добавить unit-тесты на `useSimulation`, parser fragmented SSE/UTF-8 chunks и Playwright E2E для маршрута `5 решений → анализ → питч`.

## Полезные официальные ссылки

- [Recharts RadarChart API](https://recharts.github.io/en-US/api/RadarChart/)
- [Recharts accessibility](https://github.com/recharts/recharts/wiki/Recharts-and-accessibility)
- [react-markdown](https://github.com/remarkjs/react-markdown)
- [MDN event stream format](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#event_stream_format)
- [MDN streaming fetch response](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#streaming_the_response_body)
