"""Single-origin API: authoritative catalog/calculator and validated OpenAI analysis."""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from openai import AsyncOpenAI

from city_simulator import (
    BUDGET_LIMIT, CitySimulator, Dataset, ScoringRules, SimulationRequest,
    SimulationResult, SimulationValidationError, StrictModel, DistrictResult, ScoreBreakdown,
    CRITICAL_THRESHOLD,
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


class BaselineResponse(StrictModel):
    score: float
    score_breakdown: ScoreBreakdown
    districts: list[DistrictResult]


class CatalogResponse(StrictModel):
    dataset: Dataset
    rules: ScoringRules
    methodology: ScoringRules
    baseline: BaselineResponse
    critical_threshold: Literal[40]
    budget_limit: int
    required_decisions: int
    max_per_category: int
    metric_labels: dict[str, str]
    example_plan: SimulationRequest
    ai_available: bool


class AnalysisResponse(StrictModel):
    simulation: SimulationResult
    assessment: Assessment


class AnalysisRequest(SimulationRequest):
    provider: Literal["auto", "openai", "nvidia"] = "auto"


class ProviderAnalysisResponse(AnalysisResponse):
    provider_used: str


def create_app(
    simulator: CitySimulator | None = None, *, router: LLMRouter | None = None,
    env_file: Path | None = ROOT / ".env", enable_ai: bool = True,
    static_dir: Path | None = ROOT / "dist", load_environment: bool = True,
) -> FastAPI:
    """Create one reusable router per lifespan. Injected routers belong to the caller.

    Only IDs/assignments cross the input boundary: clients cannot send their own
    costs, totals, scoring rules or AI prompts. Missing API keys leave math usable.
    """
    if load_environment and env_file is not None:
        load_dotenv(env_file, override=False)
    if simulator is None:
        dataset = Dataset.from_json(os.environ.get("CITY_DATA_PATH", str(ROOT / "data/city.json")))
        rules_path = Path(os.environ.get("CITY_RULES_PATH", str(ROOT / "data/rules.json")))
        simulator = CitySimulator(dataset, ScoringRules.model_validate_json(rules_path.read_text(encoding="utf-8")))
    source_catalog = simulator.catalog()
    dataset = Dataset.model_validate(source_catalog["dataset"])
    rules = ScoringRules.model_validate(source_catalog["methodology"])
    example_plan = SimulationRequest.model_validate_json(
        (ROOT / "examples/official_request.json").read_text(encoding="utf-8")
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        owned = None
        if router is None and enable_ai:
            try:
                owned = LLMRouter.from_env()
            except ValueError:
                # An incomplete optional NVIDIA config must not disable OpenAI.
                if os.getenv("OPENAI_API_KEY", "").strip():
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
            dataset=dataset, rules=rules, methodology=rules,
            baseline=BaselineResponse.model_validate(source_catalog["baseline"]),
            critical_threshold=CRITICAL_THRESHOLD, budget_limit=BUDGET_LIMIT,
            required_decisions=5, max_per_category=2, metric_labels=METRIC_LABELS,
            example_plan=example_plan,
            ai_available=active_router is not None and "openai" in active_router.providers,
        )

    @app.get("/api/health")
    def health():
        active_router = app.state.llm_router
        return {"status": "ok", "llm_configured": active_router is not None,
                "providers": sorted(active_router.providers) if active_router else []}

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

    @app.post("/api/analyze", response_model=ProviderAnalysisResponse)
    async def analyze_provider(request: AnalysisRequest) -> ProviderAnalysisResponse:
        # Preserve the provider-aware route introduced in main. Never trust client totals.
        result = simulate(SimulationRequest(measure_ids=request.measure_ids,
                                            district_assignments=request.district_assignments))
        active_router = app.state.llm_router
        if active_router is None:
            raise HTTPException(503, detail={
                "code": "llm_not_configured",
                "message": "AI не настроен. Задайте OPENAI_API_KEY в .env сервера и перезапустите backend. Расчёт доступен без AI.",
            })
        configured = active_router.providers
        primary, fallback = request.provider, None
        if primary == "auto":
            primary = "openai" if "openai" in configured else "nvidia"
            if primary == "openai" and "nvidia" in configured:
                fallback = "nvidia"
        if primary not in configured:
            raise HTTPException(503, detail={
                "code": "provider_not_configured", "message": "Выбранный провайдер не настроен на сервере.",
            })
        try:
            assessment, provider_used = await active_router.assess_with_provider(
                result.model_dump(mode="json"), provider=primary, fallback=fallback,
            )
        except AssessmentUnavailable as error:
            logger.warning("Analysis failed: %s", error)
            raise HTTPException(502, detail={
                "code": "assessment_unavailable",
                "message": "Не удалось получить проверенный ответ AI. Повторите анализ. Расчёт показателей сохранён.",
            }) from error
        return ProviderAnalysisResponse(simulation=result, assessment=Assessment.model_validate(assessment),
                                        provider_used=provider_used)

    @app.post("/api/analysis", response_model=AnalysisResponse)
    async def analyze(request: SimulationRequest) -> AnalysisResponse:
        # The dashboard deliberately uses OpenAI only; no implicit NVIDIA fallback.
        try:
            response = await analyze_provider(AnalysisRequest(**request.model_dump(), provider="openai"))
        except HTTPException as error:
            if error.status_code not in (502, 503):
                raise
            raise HTTPException(503, error.detail["message"]) from error
        return AnalysisResponse(simulation=response.simulation, assessment=response.assessment)

    if static_dir is not None and static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
    return app
