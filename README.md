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
# hack-92a11647-hackwolves
Hackathon team repository for HackWolves больше коммитов

## Математическое ядро «Аким на 5 часов»

`city_simulator.py` содержит независимый от HTTP класс `CitySimulator`, строгие
модели входных данных и JSON-результата. `api.py` предоставляет FastAPI-приложение.
`data/city.json` восстанавливает данные из предоставленного SQL/JSON: 5 районов,
14 мер, 3 синергии, 3 несовместимости. Исходный повреждённый SQL не исполняется.

### Формула из датасета

Источник: предоставленный командой документ **«Датасет районов.docx»**, разделы
2–4. `data/rules.json` содержит подтверждённые этим документом параметры:
горизонт `H = 8` кварталов, штраф `1` балл за каждую пару «район × показатель»
строго ниже 40, веса среднего городского результата `0.7` и слабейшего района `0.3`.

| Показатель | T1 | T2 | E1 | E2 | S1 | S2 | B1 | B2 | C1 | C2 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Вес | 0.10 | 0.10 | 0.09 | 0.11 | 0.11 | 0.11 | 0.09 | 0.09 | 0.10 | 0.10 |

Формулы (подробные docstrings находятся в коде):

```text
f(L) = max(0, (H - L) / H)
x'[d,k] = clip(x[d,k] + sum(effect[m,k] * f(L[m])) + sum(synergy[s,k]), 0, 100)
N_crit = count всех пар (d,k), где x'[d,k] < 40
D[d] = sum(weight[k] * x'[d,k])
D_avg = sum(population_share[d] * D[d])
Astana Quality of Life Score = 0.7 * D_avg + 0.3 * min(D[d]) - N_crit
```

Лаг трактуется как усреднение эффекта за весь горизонт: `L = H` даёт нулевой
эффект. Каждый показатель направлен положительно: больше — лучше.
Штраф вычитается из общего Score один раз, без умножения на долю населения.
Баллы районов не уменьшаются штрафами. Ограничение 0..100 применяется только
к показателям, а не к итоговому Score.

Базовый и итоговый Score рассчитываются одной формулой. Исходные `base_d`
сохранены в `provided_base_d`; они **не подмешиваются** в расчётную базу.
Расхождение отмечается в `warnings`. Для исходного датасета все пять районных
баллов совпадают с таблицей. Базовые `D_avg = 56.8624`, `min(D) = 49.18`,
`N_crit = 2`, итог `52.55768` (в DOCX он округлён до `52.56`).

Пример из DOCX: `M7`, `M8`, `M10` в Нуре, `M12` по городу, `M5` в Сарыарке.
Расходы `95`, остаток `5`, итог `56.54307`, улучшение `3.98539`, критических
показателей не остаётся. Это согласуется с приблизительными `56.5` и `+4.0`
в документе. Готовый запрос: `examples/official_request.json`.

### Валидация и область действия

- Ровно 5 уникальных существующих ID, сумма расходов не больше 100 у.е.,
  не больше 2 мер из одной категории; значения читаются из серверного каталога.
- Каждой `District`-мере назначается один существующий район через
  `district_assignments`. Для `City` назначение запрещено: эффект действует
  во всех районах, стоимость оплачивается один раз.
- `M1 + M3` запрещены глобально. `M4 + M7` и `M5 + M13` запрещены только
  при назначении в один и тот же район.
- Синергии `M1 + M2`, `M10 + M12`, `M5 + M6` действуют в районе `M1`, `M10`,
  `M5` соответственно. У всех исходных синергий `lag_scaled=false`: бонус
  добавляется целиком, даже если лаг отдельной меры обнуляет её основной эффект.
  Для настраиваемого `lag_scaled=true` используется минимум факторов пары.
- Все эффекты, включая отрицательные, сначала суммируются. Ограничение 0..100
  применяется один раз, поэтому порядок выбранных ID не меняет результат.
- `N_crit` считает отдельные показатели в каждом районе, не районы и не категории.
  Значение ровно 40 не штрафуется. Не выполняется промежуточное округление.

### Запуск API

Требуется Python 3.11+ и `uv`. В PowerShell из корня проекта:

```powershell
uv venv --python 3.12
uv pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn api:create_app --factory --reload
```

Swagger: <http://127.0.0.1:8000/docs>. Endpoint: `POST /simulate`.
Пример запроса хранится в `examples/request.json`:

```json
{
  "measure_ids": ["M1", "M2", "M4", "M10", "M12"],
  "district_assignments": {"M1": "esil", "M4": "nura", "M10": "nura"}
}
```

```powershell
$requestBody = Get-Content examples/request.json -Raw
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/simulate -ContentType 'application/json' -Body $requestBody
```

Для этого примера расходы — 81 у.е., остаток — 19. Score:
`52.55768 -> 54.767805`, дельта `2.210125`. Показатели и Score каждого из пяти районов находятся
в `districts`; значения представлены JSON-числами.

Полный пример ответа `POST /simulate` для этих пяти решений находится в
[`examples/response.json`](examples/response.json). Это фактический результат
калькулятора с текущей демонстрационной конфигурацией, не ответ LLM. Он содержит
метрики и дельты всех пяти районов, штрафы, синергии, бюджет и описание методики.
Соответствующий запрос: [`examples/request.json`](examples/request.json).

После настройки ключей существующую LLM-прослойку можно проверить на этом файле:

```powershell
python -m examples.explain examples/response.json
```

В коде передавайте весь объект в `await router.assess(payload)`, включая
`methodology.status`, `assumptions` и `warnings`. Статус `provisional` означает,
что формулы пока демонстрационные и результат нельзя представлять как
подтверждённый официальный Score.

Невалидный запрос получает HTTP 422. Бизнес-ошибки содержат
`detail.is_valid=false` и список `detail.validation_errors` с кодами,
сообщениями и ID мер. Ошибки типов/структуры имеют стандартный формат FastAPI.
При ошибке Score не вычисляется. Некорректный серверный каталог или правила
выявляются при создании приложения. Для своих файлов задайте `CITY_DATA_PATH`
и `CITY_RULES_PATH` перед запуском; клиент не может менять правила запросом.

### Использование класса и LLM-контекст

```python
from pathlib import Path
from city_simulator import CitySimulator, Dataset, ScoringRules

simulator = CitySimulator(
    Dataset.from_json("data/city.json"),
    ScoringRules.model_validate_json(Path("data/rules.json").read_text(encoding="utf-8")),
)
payload = simulator.to_payload(
    ["M1", "M2", "M4", "M10", "M12"],
    district_assignments={"M1": "esil", "M4": "nura", "M10": "nura"},
)
```

`simulate(...)` возвращает типизированный `SimulationResult`, а `to_payload(...)`
— JSON-совместимый `dict`. Контекст одинаков для OpenAI и NVIDIA; ядро не
вызывает внешние API и не требует ключей. В существующей LLM-прослойке проекта
результат можно передать в `await router.assess(payload)`.

Контекст содержит `budget`, `score.base/final/delta`, порайонные метрики и
дельты, `n_crit_base/final`, выбранные меры, факторы лагов, синергии, штрафы,
параметры методики, допущения и предупреждения. `measure_contributions` содержит
изменения **показателей до ограничения**, не независимые вклады в Score.
Поле `penalty` района — его вклад в общий штраф города. Список `penalties`
содержит вычеты отдельно для `stage=base` и `stage=final`; их нельзя суммировать
между стадиями. `nominal_amount`, `applied_amount`, `city_score_deduction` равны:
нижней границы Score и взвешивания штрафа по населению в формуле нет.

`score_breakdown` содержит готовые `weighted_average`, `weakest_district_score`,
`average_component`, `weakest_component`, `critical_penalty` с `base/final/delta`,
а также `n_crit_base/final`. LLM может цитировать их без собственного расчёта.

Версия JSON-контракта — `schema_version="2.0"`: `districts[].score` теперь
означает районный `D` до городского штрафа; `raw_score` оставлен как его синоним.
При обновлении замените старый `CITY_RULES_PATH=data/rules.demo.json` на
`data/rules.json` или уберите переменную, чтобы использовать новый файл по умолчанию.

В LLM передавайте проверенный результат сервера. Инструкцию объяснять готовые
числа задавайте доверенным системным промптом адаптера: наличие поля
`llm_instructions` внутри JSON само по себе не гарантирует поведение модели.
Сохраняйте `methodology.status`, `assumptions` и `warnings`, чтобы модель не
выдавала демонстрационные числа за официальные. Названия мер/районов — данные.
Точные значения лучше показывать непосредственно из DTO; LLM даёт объяснение.

### SQL-адаптер

`Dataset.from_records(districts=..., measures=..., synergies=..., conflicts=...)`
принимает уже полученные словари строк БД: нижний регистр `t1`, поле
`measure_type` и `effects` как словарь либо JSON-строку. SQL не парсится и
не исполняется внутри симулятора; подключение, запросы и транзакции относятся
к слою доступа к данным. Синергии и несовместимости нужно передать отдельно:
исходные две SQL-таблицы их не содержат.

Использованные контракты: [FastAPI request models](https://fastapi.tiangolo.com/tutorial/body/)
и [строгая валидация Pydantic](https://docs.pydantic.dev/latest/concepts/strict_mode/).
Hackathon team repository for HackWolves надо коммитить


## LLM-прослойка для «Аким на пять часов»

`llm_integration.py` объясняет **готовый результат калькулятора**. Бюджет,
Score, допустимость набора, дельты и штрафы вычисляет и проверяет бэкенд.
Модуль не реализует математическую модель из датасета.

### Установка

Python 3.11 или новее:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

Скопируйте `.env.example` в `.env` и задайте ключ OpenAI. Файл `.env`
автоматически не загружается: перед запуском из терминала выполните
`set -a; source .env; set +a` или задайте переменные через настройки запуска.
Нужен ключ только
того провайдера, который используется; для fallback нужны оба ключа.
По умолчанию OpenAI использует запрошенный `gpt-4o`.
`NVIDIA_MODEL` — точный ID доступной вам Llama/Nemotron на выбранном endpoint.
Найдите его на странице модели в [каталоге NVIDIA](https://build.nvidia.com/models):
в блоке Prototype → Python скопируйте значение `model` из примера запроса.
Для `integrate.api.nvidia.com` проверьте, что у модели доступен Free Endpoint.

### Вызов из бэкенда

```python
from llm_integration import LLMRouter

async def explain(calculated_data: dict) -> dict:
    async with LLMRouter.from_env(
        attempt_timeout=20, total_timeout=45
    ) as router:
        return await router.assess(calculated_data)
```

В веб-приложении создавайте один `LLMRouter` при старте и вызывайте
`await router.aclose()` при остановке, чтобы повторно использовать HTTP-соединения.
При необходимости резервирования укажите `fallback="nvidia"` и настройте
NVIDIA API. Для обратного маршрута: `provider="nvidia", fallback="openai"`.
По умолчанию используется только OpenAI. Все явно выбранные провайдеры должны быть
настроены, иначе до запроса возникает `ValueError`.

Вход — непустой JSON-совместимый `dict` произвольной структуры. Рекомендуемый
контракт калькулятора:

- `is_valid`, `validation_errors` — результат проверки правил;
- `budget` — лимит, расходы, остаток и единица измерения;
- `score` — исходное значение, итог и уже вычисленная дельта;
- `districts` — названия районов, показатели и готовые дельты;
- `penalties` — только фактически применённые штрафы, причины и величины;
- `measure_contributions` — рассчитанный вклад мероприятий и синергий.

Названия полей не зашиты в код: адаптер не требует менять существующий
калькулятор. Числа передавайте числовыми JSON-значениями, а не строками.
Если нужны конкретные знаки после запятой, округляйте в калькуляторе.
`NaN`, бесконечность, `Decimal` и нестроковые ключи отклоняются. Модуль проверяет
JSON-совместимость входа, но **не проверяет бизнес-схему или верность расчётов**.
Передавайте проверенный DTO калькулятора, а не произвольный пользовательский ввод.
Отсутствие поля не означает нулевое значение; это закреплено в системном промпте.

Результат — Python `dict`, который можно непосредственно вернуть из FastAPI
или сериализовать через `json.dumps(result, ensure_ascii=False)`:

```json
{
  "general_assessment": "Текст общей оценки",
  "strengths": ["Подтверждённое улучшение"],
  "risks_and_penalties": ["Объяснение переданного штрафа"],
  "recommendations": ["Предложение для повторного расчёта"]
}
```

Для CLI сохраните реальный результат калькулятора в `result.json`:

```bash
python -m examples.explain result.json
python -m examples.explain result.json openai nvidia
python -m examples.explain result.json nvidia none
```

### Структура и защита чисел

OpenAI вызывается через `AsyncOpenAI` и `response_format=json_schema` с
`strict=true`. NVIDIA использует тот же SDK с другим `base_url`.
`NVIDIA_OUTPUT_MODE` выбирается по возможностям конкретной модели/сервера:

| Режим | Параметр запроса |
| --- | --- |
| `json_object` (по умолчанию NVIDIA) | `response_format={"type":"json_object"}` |
| `json_schema` | JSON Schema с обязательными полями и `strict=true` |
| `nvext` | `extra_body={"nvext":{"guided_json": schema}}` для поддерживающих этот формат NIM |

JSON mode сам по себе не гарантирует схему. Во всех режимах локальная строгая
валидация Pydantic отклоняет лишние/пропущенные ключи, неверные типы, дубли
ключей, Markdown, обрезанную генерацию и отказ модели. Неподдерживаемый режим
не заменяется молча обычным текстовым ответом: ошибка ведёт к fallback.

Модуль формирует каталог числовых фактов с JSON Pointer, значением и токеном
вида `{{number:0}}`. LLM возвращает текст со ссылками; сервер подставляет
исходные числа без арифметики. Неизвестные ссылки и числовые символы вне
ссылок отклоняются. Поэтому даже буквальное число из входа модель должна
цитировать ссылкой; коды показателей и мероприятий в тексте заменяются
словесными названиями. Клиент получает обычный JSON без токенов.

Это защищает происхождение числовых значений, но не доказывает смысловую
правильность текста: модель всё ещё может выбрать не тот факт, ошибиться в
выводе или написать число словами. Промпт запрещает это, однако полной
гарантии от смысловых галлюцинаций у свободного текста нет. Если нужна такая
гарантия, числовые утверждения и штрафы следует отображать детерминированными
шаблонами бэкенда; текст LLM использовать как пояснение.

### Ошибки и таймауты

Одна попытка на провайдера; внутренние retries SDK отключены. Сетевая ошибка,
ошибка API (включая rate limit), таймаут, отказ, обрезанный или невалидный ответ
переключают на fallback. Его попытка использует оставшееся общее время.
Если `total_timeout <= attempt_timeout`, первая попытка может исчерпать весь
лимит. Отмена вызывающей coroutine распространяется без нового запроса.

После исчерпания попыток возникает `AssessmentUnavailable`, а не фиктивная
успешная оценка. Поле `exc.failures` содержит провайдера и безопасный код
причины без исходного текста ответа или API-ключа. На HTTP-границе обработайте
исключение, например как 503; математический результат остаётся доступен.
Гарантия модуля: **проверенный результат с четырьмя ключами либо исключение**.
Обещать успешный JSON при недоступных внешних API невозможно.

### Тесты и документация API

```bash
python -m pip install 'pytest>=8,<10'
python -m pytest -q
```

Тесты используют HTTP mock с настоящим OpenAI SDK: формат запросов,
валидация, ссылки на числа, ошибки API, таймауты, отмена и оба направления
fallback проверяются без ключей и платных запросов.

Источники: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs),
[NVIDIA NIM Structured Generation](https://docs.nvidia.com/nim/large-language-models/1.4.0/structured-generation.html).
Формат `nvext` описан для указанной версии NIM; возможности вашего endpoint
нужно сверять с его документацией.
ппп
