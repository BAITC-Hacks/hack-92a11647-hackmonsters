"""Regression cases for the formula in «Датасет районов.docx», section 3."""

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from api import create_app
from city_simulator import CitySimulator, Dataset, ScoringRules


ROOT = Path(__file__).resolve().parents[1]


def load_json(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def simulator(data=None):
    return CitySimulator(
        Dataset.from_records(**(load_json("data/city.json") if data is None else data)),
        ScoringRules.model_validate(load_json("data/rules.json")),
    )


def test_docx_reference_plan():
    result = simulator().simulate(**load_json("examples/official_request.json"))
    # Fixed expected values from the document's weights and hand-derived effects.
    assert result.score.model_dump() == {
        "base": 52.55768, "final": 56.54307, "delta": 3.98539,
    }
    assert result.budget.spent == 95
    assert result.budget.remaining == 5
    assert {d.id: d.score.base for d in result.districts} == {
        "esil": 62.99, "almaty": 57.06, "saryarka": 54.65,
        "baikonur": 56.63, "nura": 49.18,
    }
    assert {d.id: d.score.final for d in result.districts} == {
        "esil": 63.4275, "almaty": 57.4975, "saryarka": 56.3,
        "baikonur": 57.0675, "nura": 52.9625,
    }
    nura = next(d for d in result.districts if d.id == "nura")
    assert nura.metrics["S1"].final == 48
    assert nura.metrics["S2"].final == 43.75
    assert nura.metrics["B1"].final == 67.5  # includes unscaled synergy +2
    assert result.score_breakdown.weighted_average.final == 58.0776
    assert result.score_breakdown.weakest_district_score.final == 52.9625
    assert result.score_breakdown.n_crit_base == 2
    assert result.score_breakdown.n_crit_final == 0
    assert result.score_breakdown.critical_penalty.delta == -2
    assert not [p for p in result.penalties if p.stage == "final"]
    assert not result.warnings


def test_penalties_are_citywide_and_do_not_reduce_district_score():
    result = simulator().simulate(**load_json("examples/request.json"))
    assert result.score.final == 54.767805
    assert result.score_breakdown.weighted_average.final == 58.55615
    assert result.score_breakdown.weakest_district_score.final == 52.595
    assert result.score_breakdown.critical_penalty.final == 2
    penalties = [p for p in result.penalties if p.stage == "final"]
    assert len(penalties) == 1
    assert penalties[0].district_id == "nura"
    assert penalties[0].city_score_deduction == 2  # not 2 * 0.16
    nura = next(d for d in result.districts if d.id == "nura")
    assert nura.score == nura.raw_score
    assert nura.score.base == 49.18


@pytest.mark.parametrize(("value", "critical"), [(40, 0), (39.999, 1)])
def test_threshold_is_strictly_below_forty(value, critical):
    data = load_json("data/city.json")
    nura = next(d for d in data["districts"] if d["id"] == "nura")
    nura.update(S1=value, S2=40)
    result = simulator(data).simulate(**load_json("examples/request.json"))
    assert result.score_breakdown.n_crit_base == critical
    assert result.score_breakdown.n_crit_final == critical
    assert result.score_breakdown.critical_penalty.final == critical


def test_weakest_district_is_selected_dynamically():
    data = load_json("data/city.json")
    nura = next(d for d in data["districts"] if d["id"] == "nura")
    for metric in load_json("data/rules.json")["metric_weights"]:
        nura[metric] = 100
    result = simulator(data).simulate(**load_json("examples/request.json"))
    # Saryarka, not Nura, is now the weakest district.
    assert result.score_breakdown.weakest_district_score.base == 54.65
    assert result.score_breakdown.weakest_district_score.final == 55.59
    assert result.score_breakdown.weakest_component.final == 16.677
    assert result.score.final == pytest.approx(
        0.7 * result.score_breakdown.weighted_average.final + 16.677, abs=1e-6
    )


def test_city_score_is_not_clamped_to_zero():
    data = load_json("data/city.json")
    for district in data["districts"]:
        for metric in load_json("data/rules.json")["metric_weights"]:
            district[metric] = 0
    for measure in data["measures"]:
        measure["effects"] = {k: 0 for k in measure["effects"]}
    for synergy in data["synergies"]:
        synergy["bonus"] = {k: 0 for k in synergy["bonus"]}
    result = simulator(data).simulate(**load_json("examples/request.json"))
    assert result.score.base == result.score.final == -50
    assert result.score_breakdown.n_crit_final == 50
    assert sum(p.city_score_deduction for p in result.penalties if p.stage == "final") == 50


def test_order_does_not_change_score():
    plan = load_json("examples/official_request.json")
    engine = simulator()
    expected = engine.simulate(**plan)
    plan["measure_ids"].reverse()
    assert engine.simulate(**plan) == expected


def test_rejects_city_weights_not_summing_to_one():
    rules = load_json("data/rules.json")
    rules["weakest_district_weight"] = 0.2
    with pytest.raises(ValidationError, match="weights must sum to one"):
        ScoringRules.model_validate(rules)


def test_api_defaults_to_dataset_formula(monkeypatch):
    monkeypatch.delenv("CITY_DATA_PATH", raising=False)
    monkeypatch.delenv("CITY_RULES_PATH", raising=False)
    with TestClient(create_app()) as client:
        response = client.post("/simulate", json=load_json("examples/official_request.json"))
        assert response.status_code == 200
        body = response.json()
        assert body["schema_version"] == "2.0"
        assert body["methodology"]["status"] == "confirmed"
        assert body["score"]["final"] == 56.54307
        assert body["score_breakdown"]["critical_penalty"]["final"] == 0
        plan = load_json("examples/official_request.json")
        plan["measure_ids"][0] = "M5"  # duplicate ID
        response = client.post("/simulate", json=plan)
        assert response.status_code == 422
        assert response.json()["detail"]["is_valid"] is False
