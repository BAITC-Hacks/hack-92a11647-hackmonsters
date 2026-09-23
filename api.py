"""FastAPI transport for the deterministic city simulator."""

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException

from city_simulator import (
    CitySimulator,
    Dataset,
    ScoringRules,
    SimulationRequest,
    SimulationResult,
    SimulationValidationError,
)


def create_app(simulator: CitySimulator | None = None) -> FastAPI:
    """Build an app with an injected simulator or server-configured JSON files.

    CITY_DATA_PATH and CITY_RULES_PATH are read only at app construction.
    Invalid server data fails at startup, while invalid user plans return 422.
    Clients cannot override costs, effects, scoring weights or budget limits.
    """
    if simulator is None:
        data_directory = Path(__file__).resolve().parent / "data"
        dataset = Dataset.from_json(os.environ.get("CITY_DATA_PATH", str(data_directory / "city.json")))
        rules_path = Path(os.environ.get("CITY_RULES_PATH", str(data_directory / "rules.demo.json")))
        rules = ScoringRules.model_validate_json(rules_path.read_text(encoding="utf-8"))
        simulator = CitySimulator(dataset, rules)

    app = FastAPI(
        title="Аким на 5 часов — City Simulator",
        version="1.0.0",
        description="Детерминированный расчёт и контекст для LLM. По умолчанию используется демонстрационная методика.",
    )

    @app.post("/simulate", response_model=SimulationResult)
    def simulate(request: SimulationRequest) -> SimulationResult:
        try:
            return simulator.simulate(request.measure_ids, district_assignments=request.district_assignments)
        except SimulationValidationError as error:
            raise HTTPException(
                status_code=422,
                detail={"is_valid": False, "validation_errors": [issue.model_dump() for issue in error.issues]},
            ) from error

    return app
