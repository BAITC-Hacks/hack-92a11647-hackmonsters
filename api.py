"""Single-origin API: authoritative catalog/calculator and validated OpenAI analysis."""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from openai import AsyncOpenAI

from city_simulator import (
    BUDGET_LIMIT, CitySimulator, Dataset, ScoringRules, SimulationRequest,
    SimulationResult, SimulationValidationError, StrictModel,
)
from llm_integration import Assessment, AssessmentUnavailable, LLMRouter, OpenAICompatibleProvider

ROOT = Path(__file__).resolve().parent
logger = logging.getLogger(__name__)
METRIC_LABELS = {
    "T1": "Разгрузка дорог", "T2": "Доступность общественного транспорта",
    "E1": "Озеленение", "E2": "Качество воздуха",
    "S1": "Школы и детсады", "S2": "Поликлиники и первичная медпомощь",
    "B1": "Безопасность улиц", "B2": "Безопасность дорожного движения",
    "C1": "Надёжность ЖКХ", "C2": "Скорость решения обращений жителей",
}


class CatalogResponse(StrictModel):
    dataset: Dataset
    rules: ScoringRules
    budget_limit: int
    required_decisions: int
    max_per_category: int
    metric_labels: dict[str, str]
    example_plan: SimulationRequest
    ai_available: bool


class AnalysisResponse(StrictModel):
    simulation: SimulationResult
    assessment: Assessment


def create_app(
    simulator: CitySimulator | None = None, *, router: LLMRouter | None = None,
    env_file: Path | None = ROOT / ".env", enable_ai: bool = True,
    static_dir: Path | None = ROOT / "dist",
) -> FastAPI:
    """Create one reusable router per lifespan. Injected routers belong to the caller.

    Only IDs/assignments cross the input boundary: clients cannot send their own
    costs, totals, scoring rules or AI prompts. Missing API keys leave math usable.
    """
    if env_file is not None:
        load_dotenv(env_file, override=False)
    if simulator is None:
        dataset = Dataset.from_json(os.environ.get("CITY_DATA_PATH", str(ROOT / "data/city.json")))
        rules_path = Path(os.environ.get("CITY_RULES_PATH", str(ROOT / "data/rules.json")))
        simulator = CitySimulator(dataset, ScoringRules.model_validate_json(rules_path.read_text(encoding="utf-8")))
    dataset, rules = simulator.catalog()
    example_plan = SimulationRequest.model_validate_json(
        (ROOT / "examples/official_request.json").read_text(encoding="utf-8")
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        owned = None
        if router is None and enable_ai and os.getenv("OPENAI_API_KEY", "").strip():
            # The web application intentionally uses OpenAI only. Optional NVIDIA
            # configuration cannot prevent the calculator or OpenAI from starting.
            owned = LLMRouter({"openai": OpenAICompatibleProvider(
                AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"], max_retries=0, timeout=20),
                os.getenv("OPENAI_MODEL", "gpt-4o").strip() or "gpt-4o",
            )})
        app.state.llm_router = router or owned
        try:
            yield
        finally:
            if owned is not None:
                await owned.aclose()

    app = FastAPI(title="Аким на 5 часов — City Simulator", version="2.1.0", lifespan=lifespan)
    app.state.llm_router = router

    @app.get("/api/catalog", response_model=CatalogResponse)
    def catalog() -> CatalogResponse:
        active_router = app.state.llm_router
        return CatalogResponse(
            dataset=dataset, rules=rules, budget_limit=BUDGET_LIMIT,
            required_decisions=5, max_per_category=2, metric_labels=METRIC_LABELS,
            example_plan=example_plan,
            ai_available=active_router is not None and "openai" in active_router.providers,
        )

    @app.post("/simulate", response_model=SimulationResult)
    @app.post("/api/simulate", response_model=SimulationResult)
    def simulate(request: SimulationRequest) -> SimulationResult:
        try:
            return simulator.simulate(request.measure_ids, district_assignments=request.district_assignments)
        except SimulationValidationError as error:
            raise HTTPException(status_code=422, detail={
                "is_valid": False,
                "validation_errors": [issue.model_dump() for issue in error.issues],
            }) from error

    @app.post("/api/analysis", response_model=AnalysisResponse)
    async def analyze(request: SimulationRequest) -> AnalysisResponse:
        result = simulate(request)  # Always recompute from trusted data, even for direct API callers.
        active_router = app.state.llm_router
        if active_router is None or "openai" not in active_router.providers:
            raise HTTPException(503, "AI не настроен: задайте OPENAI_API_KEY в .env на сервере и перезапустите backend. Расчёт доступен без AI.")
        try:
            assessment = await active_router.assess(result.model_dump(mode="json"), provider="openai")
        except AssessmentUnavailable as error:
            # AssessmentUnavailable contains only provider names and sanitized categories.
            logger.warning("Analysis failed: %s", error)
            raise HTTPException(503, "Не удалось получить проверенный ответ OpenAI. Повторите анализ. Расчёт показателей сохранён.") from error
        return AnalysisResponse(simulation=result, assessment=Assessment.model_validate(assessment))

    if static_dir is not None and static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
    return app
