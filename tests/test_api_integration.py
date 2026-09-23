"""Offline checks for the real calculator -> HTTP -> LLM boundary."""

import asyncio
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api import create_app
from city_simulator import CitySimulator, Dataset, ScoringRules
from llm_integration import LLMRouter
from examples.export_sql import literal, render_sql


ROOT = Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


@pytest.fixture(autouse=True)
def isolated_environment(monkeypatch):
    for name in ("OPENAI_API_KEY", "NVIDIA_API_KEY", "CITY_DATA_PATH", "CITY_RULES_PATH"):
        monkeypatch.delenv(name, raising=False)


def engine():
    return CitySimulator(Dataset.from_json(ROOT / "data/city.json"),
                         ScoringRules.model_validate(read_json("data/rules.json")))


class RecordingProvider:
    def __init__(self, *, invalid=False):
        self.payloads = []
        self.invalid = invalid
        self.closed = False

    async def generate(self, payload):
        context = json.loads(payload)
        self.payloads.append(context)
        if self.invalid:
            return "not JSON"
        facts = {fact["path"]: fact["token"] for fact in context["numeric_facts"]}
        return json.dumps({
            "general_assessment": "Итоговый Score: " + facts["/score/final"],
            "strengths": ["Дельта Score: " + facts["/score/delta"]],
            "risks_and_penalties": ["Штраф: " + facts["/score_breakdown/critical_penalty/final"]],
            "recommendations": ["Остаток бюджета: " + facts["/budget/remaining"]],
        })

    async def aclose(self):
        self.closed = True


def test_catalog_matches_calculator_and_is_not_mutable():
    simulator = engine()
    baseline = simulator.simulate(**read_json("examples/official_request.json"))
    catalog = simulator.catalog()
    assert len(catalog["dataset"]["districts"]) == 5
    assert len(catalog["dataset"]["measures"]) == 14
    assert catalog["baseline"]["score"] == baseline.score.base
    assert catalog["baseline"]["score_breakdown"]["n_crit_final"] == 2
    assert catalog["max_per_category"] == 2
    assert catalog["budget_limit"] == 100
    assert {district["id"]: district["score"]["base"] for district in catalog["baseline"]["districts"]} == {
        district.id: district.score.base for district in baseline.districts
    }
    catalog["dataset"]["measures"][0]["cost"] = 0
    assert simulator.catalog()["dataset"]["measures"][0]["cost"] == 18
    with TestClient(create_app(simulator, load_environment=False)) as client:
        assert client.get("/api/catalog").json() == simulator.catalog()
        assert client.get("/api/health").json() == {"status": "ok", "llm_configured": False, "providers": []}


def test_sql_seed_matches_canonical_json():
    expected = render_sql(Dataset.from_json(ROOT / "data/city.json"),
                          ScoringRules.model_validate(read_json("data/rules.json")))
    assert (ROOT / "dataset.sql").read_text(encoding="utf-8") == expected
    assert expected.count("INSERT INTO districts ") == 5
    assert expected.count("INSERT INTO measures ") == 14
    assert literal("O'Brien") == "'O''Brien'"


def test_json_example_and_legacy_route_match_current_contract():
    plan = read_json("examples/request.json")
    with TestClient(create_app(load_environment=False)) as client:
        expected = read_json("examples/response.json")
        assert expected == client.post("/api/simulate", json=plan).json()
        assert expected == client.post("/simulate", json=plan).json()
        assert expected["score"] == {"base": 52.55768, "final": 54.767805, "delta": 2.210125}


@pytest.mark.parametrize(("ids", "assignments", "code"), [
    (["M7", "M7", "M10", "M12", "M5"], {"M7": "nura", "M10": "nura", "M5": "saryarka"}, "duplicate_measures"),
    (["M3", "M5", "M7", "M8", "M13"], {"M3": "esil", "M5": "saryarka", "M7": "nura", "M8": "nura", "M13": "esil"}, "budget_exceeded"),
    (["M1", "M2", "M3", "M10", "M12"], {"M1": "esil", "M3": "nura", "M10": "nura"}, "category_limit"),
    (["M1", "M3", "M4", "M10", "M12"], {"M1": "esil", "M3": "nura", "M4": "almaty", "M10": "nura"}, "incompatible_measures"),
    (["M4", "M7", "M9", "M10", "M12"], {"M4": "nura", "M7": "nura", "M9": "esil", "M10": "nura"}, "incompatible_measures"),
    (["M7", "M8", "M10", "M12", "M5"], {}, "missing_target"),
    (["M7", "M8", "M10", "M12", "M5"], {"M7": "baikonyr", "M8": "nura", "M10": "nura", "M5": "saryarka"}, "unknown_district"),
])
def test_invalid_plans_never_reach_ai(ids, assignments, code):
    provider = RecordingProvider()
    with TestClient(create_app(router=LLMRouter({"openai": provider}), load_environment=False)) as client:
        response = client.post("/api/analyze", json={"measure_ids": ids, "district_assignments": assignments})
        assert response.status_code == 422
        assert code in {issue["code"] for issue in response.json()["detail"]["validation_errors"]}
    assert provider.payloads == []


@pytest.mark.parametrize("extra", [{"score": 99}, {"budgetLimit": 1000}, {"provider": "consensus"}])
def test_untrusted_extra_fields_are_rejected(extra):
    with TestClient(create_app(load_environment=False)) as client:
        response = client.post("/api/analyze", json={**read_json("examples/request.json"), **extra})
        assert response.status_code == 422


def test_no_keys_keeps_calculation_available():
    with TestClient(create_app(load_environment=False)) as client:
        plan = read_json("examples/official_request.json")
        assert client.post("/api/simulate", json=plan).status_code == 200
        response = client.post("/api/analyze", json=plan)
        assert response.status_code == 503
        assert response.json()["detail"]["code"] == "llm_not_configured"


def test_api_fallback_receives_exact_server_payload_and_reports_actual_provider():
    primary = RecordingProvider(invalid=True)
    backup = RecordingProvider()
    router = LLMRouter({"openai": primary, "nvidia": backup})
    with TestClient(create_app(router=router, load_environment=False)) as client:
        plan = read_json("examples/official_request.json")
        response = client.post("/api/analyze", json={**plan, "provider": "auto"})
        assert response.status_code == 200
        body = response.json()
        assert body["simulation"] == client.post("/api/simulate", json=plan).json()
        assert primary.payloads[0]["calculator_result"] == body["simulation"]
        assert backup.payloads == primary.payloads
        assert body["provider_used"] == "nvidia"
        assert body["assessment"] == {
            "general_assessment": "Итоговый Score: 56.54307",
            "strengths": ["Дельта Score: 3.98539"],
            "risks_and_penalties": ["Штраф: 0.0"],
            "recommendations": ["Остаток бюджета: 5"],
        }
    assert not primary.closed
    assert not backup.closed
    asyncio.run(router.aclose())
    assert primary.closed and backup.closed


def test_explicit_provider_does_not_silently_fallback():
    primary, backup = RecordingProvider(invalid=True), RecordingProvider()
    with TestClient(create_app(router=LLMRouter({"openai": primary, "nvidia": backup}), load_environment=False)) as client:
        response = client.post("/api/analyze", json={**read_json("examples/request.json"), "provider": "openai"})
        assert response.status_code == 502
        assert response.json()["detail"]["code"] == "assessment_unavailable"
    assert backup.payloads == []


def test_nvidia_only_and_missing_explicit_provider():
    provider = RecordingProvider()
    with TestClient(create_app(router=LLMRouter({"nvidia": provider}), load_environment=False)) as client:
        plan = read_json("examples/request.json")
        assert client.post("/api/analyze", json=plan).json()["provider_used"] == "nvidia"
        response = client.post("/api/analyze", json={**plan, "provider": "openai"})
        assert response.status_code == 503
        assert response.json()["detail"]["code"] == "provider_not_configured"
    assert len(provider.payloads) == 1


def test_owned_clients_close_at_shutdown(monkeypatch):
    provider = RecordingProvider()
    router = LLMRouter({"openai": provider})
    monkeypatch.setattr(LLMRouter, "from_env", classmethod(lambda cls: router))
    with TestClient(create_app(load_environment=False)) as client:
        assert client.get("/api/health").json()["providers"] == ["openai"]
    assert provider.closed


def test_invalid_llm_config_does_not_break_calculator(monkeypatch):
    monkeypatch.setenv("NVIDIA_API_KEY", "offline-placeholder")
    monkeypatch.setenv("NVIDIA_MODEL", "")
    with TestClient(create_app(load_environment=False)) as client:
        assert client.get("/api/health").json()["llm_configured"] is False
        assert client.post("/api/simulate", json=read_json("examples/request.json")).status_code == 200
