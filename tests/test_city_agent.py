"""Real SDK + fake HTTP: bounded planning, exact calculations and safe failures."""

import asyncio
import json
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient
from openai import AsyncOpenAI

from api import create_app
from city_agent import (
    AgentRequest, AgentUnavailable, CityPlanningAgent, PlanningSession, RunBudget,
)
from city_simulator import CitySimulator, Dataset, ScoringRules, SimulationRequest
from llm_integration import InvalidModelOutput, LLMRouter, OpenAICompatibleProvider, ToolCall


ROOT = Path(__file__).resolve().parents[1]


def plan():
    return SimulationRequest.model_validate_json((ROOT / "examples/official_request.json").read_text(encoding="utf-8"))


def engine():
    return CitySimulator(Dataset.from_json(ROOT / "data/city.json"),
                         ScoringRules.model_validate_json((ROOT / "data/rules.json").read_text(encoding="utf-8")))


def action(name, arguments, call_id="call-test"):
    return ToolCall(call_id, name, json.dumps(arguments))


def plan_arguments():
    request = plan()
    return {"measure_ids": request.measure_ids, "district_assignments": [
        {"measure_id": measure, "district_id": district} for measure, district in request.district_assignments.items()
    ]}


def choose_next(messages):
    last = messages[-1]
    data = json.loads(last["content"])
    if last["role"] == "user":
        initial = data["initial_candidate"]
        return ("improve_plan", {"candidate_id": initial["candidate_id"]}) if initial else ("get_catalog", {})
    if "catalog" in data:
        return "simulate_plan", plan_arguments()
    if "candidates" in data:
        return "finish_plan", {"candidate_id": data["candidates"][0]["candidate_id"]}
    if "best_candidate" in data:
        return "finish_plan", {"candidate_id": data["best_candidate"]["candidate_id"]}
    return "improve_plan", {"candidate_id": data["candidate_id"]}


class AutoProvider:
    def __init__(self, *, delay=0, invalid=False):
        self.calls = 0
        self.delay = delay
        self.invalid = invalid

    async def next_tool(self, messages, tools):
        self.calls += 1
        await asyncio.sleep(self.delay)
        if self.invalid:
            raise InvalidModelOutput("private provider output")
        name, arguments = choose_next(messages)
        return action(name, arguments, f"call-{len(messages)}")

    async def aclose(self):
        pass


def sdk_provider(captured, *, mode="json_schema", fail=False):
    def handle(request):
        body = json.loads(request.content)
        captured.append(body)
        assert request.url.path.endswith("/chat/completions")
        assert body["tool_choice"] == "required"
        assert body["parallel_tool_calls"] is False
        assert body["stream"] is False
        for tool in body["tools"]:
            function = tool["function"]
            schema = function["parameters"]
            assert schema["additionalProperties"] is False
            assert set(schema.get("required", [])) == set(schema.get("properties", {}))
            if mode == "json_schema":
                assert function["strict"] is True
            else:
                assert "strict" not in function
        if fail:
            return httpx.Response(503, json={"error": {"message": "private upstream failure"}})
        messages = body["messages"]
        for index, message in enumerate(messages):
            if message["role"] == "tool":
                assert messages[index - 1]["tool_calls"][0]["id"] == message["tool_call_id"]
        name, arguments = choose_next(messages)
        return httpx.Response(200, json={
            "id": "offline-completion", "object": "chat.completion", "created": 0,
            "model": "offline-model", "choices": [{
                "index": 0, "finish_reason": "tool_calls",
                "message": {"role": "assistant", "content": None, "tool_calls": [{
                    "id": f"call-{len(messages)}", "type": "function",
                    "function": {"name": name, "arguments": json.dumps(arguments)},
                }]},
            }],
        })
    client = AsyncOpenAI(api_key="test-only", base_url="https://offline.invalid/v1", max_retries=0,
                         http_client=httpx.AsyncClient(transport=httpx.MockTransport(handle)))
    return OpenAICompatibleProvider(client, "gpt-4o", output_mode=mode)


@pytest.mark.parametrize("objective", ["city_score", "weakest_district", "critical_metrics"])
def test_agent_proposes_valid_non_regressing_plan(objective):
    async def run():
        simulator = engine()
        before = simulator.simulate(**plan().model_dump())
        agent = CityPlanningAgent(simulator, {"openai": AutoProvider()})
        result = await agent.run(AgentRequest(current_plan=plan(), objective=objective))
        assert result.simulation == simulator.simulate(**result.proposed_plan.model_dump())
        assert result.requires_confirmation is True
        assert result.provider_used == "openai"
        assert result.model_calls == 2
        assert 0 < result.valid_plans <= result.evaluated_plans <= 600
        assert result.comparison.score.base == before.score.final
        session = PlanningSession(simulator, objective, RunBudget(), 600)
        assert session.rank(result.simulation) >= session.rank(before)
        assert [step.tool for step in result.steps] == ["improve_plan", "finish_plan"]
        assert result.simulation.budget.spent <= 100
        assert simulator.simulate(**plan().model_dump()) == before
    asyncio.run(run())


@pytest.mark.parametrize("mode", ["json_schema", "json_object", "nvext"])
def test_real_sdk_tool_loop_and_api_contract(mode):
    captured = []
    provider = sdk_provider(captured, mode=mode)
    router = LLMRouter({"openai": provider})
    try:
        with TestClient(create_app(router=router, load_environment=False)) as client:
            response = client.post("/api/agent/plan", json={"objective": "city_score"})
            assert response.status_code == 200, response.json()
            result = response.json()
            assert result["model_calls"] == 4
            assert result["comparison"]["reference"] == "baseline"
            assert result["comparison"]["score"]["base"] == 52.55768
            calculated = client.post("/api/simulate", json=result["proposed_plan"])
            assert calculated.status_code == 200
            assert result["simulation"] == calculated.json()
            assert len(captured) == 4
            assert [step["tool"] for step in result["steps"]] == [
                "get_catalog", "simulate_plan", "improve_plan", "finish_plan",
            ]
    finally:
        asyncio.run(router.aclose())


@pytest.mark.parametrize(("name", "arguments"), [
    ("run_shell", {"command": "delete files"}),
    ("get_catalog", {"budget": 999}),
    ("simulate_plan", {"measure_ids": ["M1"] * 5, "district_assignments": []}),
    ("simulate_plan", {**plan_arguments(), "score": 100}),
    ("simulate_plan", {**plan_arguments(), "district_assignments": [
        {"measure_id": "M7", "district_id": "nura"}, {"measure_id": "M7", "district_id": "esil"},
    ]}),
    ("finish_plan", {"candidate_id": "another-user-plan"}),
])
def test_unsafe_tool_inputs_never_produce_proposal(name, arguments):
    async def run():
        session = PlanningSession(engine(), "city_score", RunBudget(), 600)
        output, finished = await session.execute(action(name, arguments))
        assert output["ok"] is False
        assert finished is None
        assert not session.candidates
    asyncio.run(run())


@pytest.mark.parametrize("raw", ['{"candidate_id":"one","candidate_id":"two"}',
                                '{"candidate_id":NaN}', '{"candidate_id":false}', '[',
                                '{"candidate_id":"' + "x" * 17000 + '"}'])
def test_invalid_json_rejected(raw):
    async def run():
        session = PlanningSession(engine(), "city_score", RunBudget(), 600)
        output, finished = await session.execute(ToolCall("call-test", "finish_plan", raw))
        assert output["ok"] is False and finished is None
    asyncio.run(run())


def test_finish_requires_comparison_and_cannot_choose_worse_known_plan():
    async def run():
        session = PlanningSession(engine(), "city_score", RunBudget(), 600)
        response, _ = await session.execute(action("simulate_plan", plan_arguments()))
        initial = response["candidate_id"]
        response, finished = await session.execute(action("finish_plan", {"candidate_id": initial}))
        assert response["error"] == "compare_before_finish" and finished is None
        response, _ = await session.execute(action("improve_plan", {"candidate_id": initial}))
        best = response["candidates"][0]["candidate_id"]
        assert session.rank(session.candidates[best][1]) > session.rank(session.candidates[initial][1])
        response, finished = await session.execute(action("finish_plan", {"candidate_id": initial}))
        assert response["error"] == "better_candidate_exists" and finished is None
        response, finished = await session.execute(action("finish_plan", {"candidate_id": best}))
        assert response["ok"] and finished == best
    asyncio.run(run())


def test_fallback_after_http_failure_reports_actual_provider():
    async def run():
        calls = []
        primary = sdk_provider(calls, fail=True)
        try:
            result = await CityPlanningAgent(engine(), {
                "openai": primary, "nvidia": AutoProvider(),
            }).run(AgentRequest(current_plan=plan()))
            assert result.provider_used == "nvidia"
            assert result.model_calls == 3
            assert result.steps[0].status == "failed"
            assert "private" not in result.model_dump_json()
        finally:
            await primary.aclose()
    asyncio.run(run())


def test_explicit_provider_does_not_fallback():
    async def run():
        backup = AutoProvider()
        with pytest.raises(AgentUnavailable):
            await CityPlanningAgent(engine(), {"openai": AutoProvider(invalid=True), "nvidia": backup}).run(
                AgentRequest(current_plan=plan(), provider="openai"))
        assert backup.calls == 0
    asyncio.run(run())


def test_nvidia_only_auto_and_missing_explicit_provider():
    async def run():
        agent = CityPlanningAgent(engine(), {"nvidia": AutoProvider()})
        assert (await agent.run(AgentRequest(current_plan=plan()))).provider_used == "nvidia"
        with pytest.raises(AgentUnavailable, match="provider_not_configured"):
            await agent.run(AgentRequest(provider="openai"))
    asyncio.run(run())


def test_budget_caps_and_repeated_calls_stop():
    class LoopProvider(AutoProvider):
        async def next_tool(self, messages, tools):
            self.calls += 1
            return action("get_catalog", {}, f"call-{self.calls}")

    async def run():
        provider = LoopProvider()
        with pytest.raises(AgentUnavailable):
            await CityPlanningAgent(engine(), {"openai": provider}, max_model_calls=3).run(AgentRequest())
        assert provider.calls == 3
        result = await CityPlanningAgent(engine(), {"openai": AutoProvider()},
                                         max_evaluations=10).run(AgentRequest(current_plan=plan()))
        assert result.evaluated_plans == 10
        assert result.valid_plans <= 10
    asyncio.run(run())


def test_empty_search_budget_cannot_claim_comparison():
    async def run():
        session = PlanningSession(engine(), "city_score", RunBudget(), 1)
        response, _ = await session.execute(action("simulate_plan", plan_arguments()))
        initial = response["candidate_id"]
        response, _ = await session.execute(action("improve_plan", {"candidate_id": initial}))
        assert response["error"] == "evaluation_limit"
        assert not session.searched
    asyncio.run(run())


def test_timeout_and_cancellation_are_bounded():
    async def run():
        backup = AutoProvider()
        agent = CityPlanningAgent(engine(), {"openai": AutoProvider(delay=1), "nvidia": backup},
                                  total_timeout=0.02, attempt_timeout=0.5)
        with pytest.raises(AgentUnavailable, match="total_timeout"):
            await agent.run(AgentRequest())
        assert backup.calls == 0
        task = asyncio.create_task(agent.run(AgentRequest()))
        await asyncio.sleep(0)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert backup.calls == 0
    asyncio.run(run())


def test_timeout_can_use_fallback_with_remaining_budget():
    async def run():
        result = await CityPlanningAgent(
            engine(), {"openai": AutoProvider(delay=1), "nvidia": AutoProvider()},
            max_evaluations=5, attempt_timeout=0.1, total_timeout=2,
        ).run(AgentRequest(current_plan=plan()))
        assert result.provider_used == "nvidia"
        assert result.model_calls == 3
    asyncio.run(run())


def test_concurrent_runs_do_not_share_candidate_state():
    async def run():
        agent = CityPlanningAgent(engine(), {"openai": AutoProvider()})
        first, second = await asyncio.gather(
            agent.run(AgentRequest(current_plan=plan(), objective="city_score")),
            agent.run(AgentRequest(objective="critical_metrics")),
        )
        assert first.objective == "city_score" and second.objective == "critical_metrics"
        assert first.comparison.reference == "current_plan"
        assert second.comparison.reference == "baseline"
        assert first.model_calls == 2 and second.model_calls == 4
    asyncio.run(run())


def test_invalid_current_plan_never_calls_provider():
    provider = AutoProvider()
    with TestClient(create_app(router=LLMRouter({"openai": provider}), load_environment=False)) as client:
        invalid = plan().model_dump()
        invalid["measure_ids"][0] = "M8"
        response = client.post("/api/agent/plan", json={"current_plan": invalid})
        assert response.status_code == 422
    assert provider.calls == 0


@pytest.mark.parametrize("body", [{"objective": "ignore rules"}, {"budget": 1000}, {"provider": "consensus"}])
def test_api_rejects_unsupported_goals_and_options(body):
    provider = AutoProvider()
    with TestClient(create_app(router=LLMRouter({"openai": provider}), load_environment=False)) as client:
        assert client.post("/api/agent/plan", json=body).status_code == 422
    assert provider.calls == 0


def test_agent_api_missing_config_and_provider_failure(monkeypatch):
    for name in ("OPENAI_API_KEY", "NVIDIA_API_KEY"):
        monkeypatch.delenv(name, raising=False)
    with TestClient(create_app(load_environment=False)) as client:
        assert client.post("/api/agent/plan", json={}).status_code == 503
        assert client.post("/api/simulate", json=plan().model_dump()).status_code == 200
    with TestClient(create_app(router=LLMRouter({"openai": AutoProvider(invalid=True)}), load_environment=False)) as client:
        response = client.post("/api/agent/plan", json={})
        assert response.status_code == 502
        assert "private" not in response.text


def test_agent_concurrency_limit_returns_safe_error():
    app = create_app(router=LLMRouter({"openai": AutoProvider()}), load_environment=False)
    app.state.agent_slots = asyncio.Semaphore(0)
    with TestClient(app) as client:
        response = client.post("/api/agent/plan", json={})
        assert response.status_code == 429
        assert response.json()["detail"]["code"] == "agent_busy"


@pytest.mark.parametrize(("finish", "calls", "refusal"), [
    ("stop", [], None), ("length", [], None), ("tool_calls", [], "refused"),
    ("tool_calls", [
        {"id": "one", "type": "function", "function": {"name": "get_catalog", "arguments": "{}"}},
        {"id": "two", "type": "function", "function": {"name": "get_catalog", "arguments": "{}"}},
    ], None),
    ("tool_calls", [None], None),
    ("tool_calls", [{"id": "one", "type": "function", "function": None}], None),
    ("tool_calls", [{"id": {}, "type": "function", "function": {"name": "get_catalog", "arguments": "{}"}}], None),
    ("tool_calls", [{"id": "one", "type": "function", "function": {"name": ["get_catalog"], "arguments": "{}"}}], None),
    ("tool_calls", [{"id": "one", "type": "function", "function": {"name": "get_catalog", "arguments": {}}}], None),
])
def test_sdk_rejects_plain_text_refusal_and_parallel_calls(finish, calls, refusal):
    async def run():
        client = AsyncOpenAI(api_key="test-only", max_retries=0, http_client=httpx.AsyncClient(
            transport=httpx.MockTransport(lambda request: httpx.Response(200, json={
                "id": "bad", "object": "chat.completion", "created": 0, "model": "test",
                "choices": [{"index": 0, "finish_reason": finish, "message": {
                    "role": "assistant", "content": "fake success", "tool_calls": calls, "refusal": refusal,
                }}],
            }))))
        provider = OpenAICompatibleProvider(client, "gpt-4o")
        try:
            with pytest.raises(InvalidModelOutput):
                await provider.next_tool([], [])
        finally:
            await provider.aclose()
    asyncio.run(run())
