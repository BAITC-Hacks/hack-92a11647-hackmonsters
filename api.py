"""Same-origin UI/API transport; the server owns calculations and credentials."""

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

from city_simulator import (
    CitySimulator, Dataset, ScoringRules, SimulationRequest,
    SimulationResult, SimulationValidationError, StrictModel,
)
from llm_integration import Assessment, AssessmentUnavailable, LLMRouter


ROOT = Path(__file__).resolve().parent


class AnalysisRequest(SimulationRequest):
    provider: Literal["auto", "openai", "nvidia"] = "auto"


class AnalysisResponse(StrictModel):
    simulation: SimulationResult
    assessment: Assessment
    provider_used: str


def create_app(simulator: CitySimulator | None = None, *,
               router: LLMRouter | None = None, load_environment: bool = True) -> FastAPI:
    """Create the calculator and optional AI service; never require keys for math.

    .env is read from the repository without overriding process environment.
    Invalid data/rules fail at construction. Missing/invalid LLM configuration
    leaves the calculator usable and returns a safe 503 on analysis.
    Injected routers belong to the caller; environment-created routers are closed
    by the lifespan. No client-supplied scores enter the prompt.
    """
    if load_environment:
        load_dotenv(ROOT / ".env", override=False)
    if simulator is None:
        dataset = Dataset.from_json(os.environ.get("CITY_DATA_PATH", str(ROOT / "data/city.json")))
        rules_path = Path(os.environ.get("CITY_RULES_PATH", str(ROOT / "data/rules.json")))
        simulator = CitySimulator(dataset, ScoringRules.model_validate_json(rules_path.read_text(encoding="utf-8")))

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        owned_router = None
        if router is None:
            try:
                owned_router = LLMRouter.from_env()
                app.state.router = owned_router
            except ValueError:
                app.state.router = None
        try:
            yield
        finally:
            if owned_router is not None:
                await owned_router.aclose()

    app = FastAPI(
        title="Аким на 5 часов — City Simulator", version="2.0.0", lifespan=lifespan,
        description="Серверный расчёт и проверенный контекст для OpenAI / NVIDIA.",
    )
    app.state.router = router

    @app.get("/api/health")
    def health() -> dict[str, Any]:
        active_router = app.state.router
        return {"status": "ok", "llm_configured": active_router is not None,
                "providers": sorted(active_router.providers) if active_router else []}

    @app.get("/api/catalog")
    def catalog() -> dict[str, Any]:
        return simulator.catalog()

    @app.post("/simulate", response_model=SimulationResult)
    @app.post("/api/simulate", response_model=SimulationResult)
    def simulate(request: SimulationRequest) -> SimulationResult:
        try:
            return simulator.simulate(request.measure_ids, district_assignments=request.district_assignments)
        except SimulationValidationError as error:
            raise HTTPException(422, detail={
                "is_valid": False, "validation_errors": [issue.model_dump() for issue in error.issues],
            }) from error

    @app.post("/api/analyze", response_model=AnalysisResponse)
    async def analyze(request: AnalysisRequest) -> AnalysisResponse:
        result = simulate(SimulationRequest(measure_ids=request.measure_ids,
                                            district_assignments=request.district_assignments))
        active_router = app.state.router
        if active_router is None:
            raise HTTPException(503, detail={
                "code": "llm_not_configured",
                "message": "Расчёт готов. Настройте OPENAI_API_KEY или NVIDIA_API_KEY и NVIDIA_MODEL в .env сервера и перезапустите его.",
            })
        configured = active_router.providers
        primary = request.provider
        fallback = None
        if primary == "auto":
            primary = "openai" if "openai" in configured else "nvidia"
            if primary == "openai" and "nvidia" in configured:
                fallback = "nvidia"
        if primary not in configured:
            raise HTTPException(503, detail={
                "code": "provider_not_configured",
                "message": "Выбранный провайдер не настроен. Выберите Авто или настройте .env сервера.",
            })
        try:
            assessment, provider_used = await active_router.assess_with_provider(
                result.model_dump(mode="json"), provider=primary, fallback=fallback,
            )
        except AssessmentUnavailable as error:
            raise HTTPException(502, detail={
                "code": "assessment_unavailable",
                "message": "AI не вернул корректный ответ за отведённое время. Расчёт сохранён; попробуйте позднее.",
            }) from error
        return AnalysisResponse(simulation=result, assessment=Assessment.model_validate(assessment),
                                provider_used=provider_used)

    if (ROOT / "dist/index.html").is_file():
        app.mount("/", StaticFiles(directory=ROOT / "dist", html=True), name="ui")
    return app
