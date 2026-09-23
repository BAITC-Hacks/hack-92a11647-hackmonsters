import asyncio
import json

import httpx
import pytest
from openai import AsyncOpenAI

from llm_integration import (
    AssessmentUnavailable, InvalidModelOutput, LLMRouter,
    OpenAICompatibleProvider, _parse_and_render, _prepare_data,
)


def output(text="Остаток бюджета: {{number:0}}.", **extra):
    return json.dumps(dict(general_assessment=text, strengths=[],
                           risks_and_penalties=[], recommendations=[], **extra))


def completion(content=None, *, finish="stop", refusal=None):
    return {"id": "test", "object": "chat.completion", "created": 0,
            "model": "test", "choices": [{"index": 0, "finish_reason": finish,
                "message": {"role": "assistant", "content": content,
                            "refusal": refusal}}]}


class FakeProvider:
    def __init__(self, result=None, *, delay=0):
        self.result = output() if result is None else result
        self.delay = delay
        self.calls = 0
        self.closed = False

    async def generate(self, payload):
        self.calls += 1
        await asyncio.sleep(self.delay)
        return self.result

    async def aclose(self):
        self.closed = True


def test_exact_numbers_and_escaped_paths():
    payload, values = _prepare_data({"a/b~": [True, None, -0.125, 9007199254740993]})
    facts = json.loads(payload)["numeric_facts"]
    assert facts[0]["path"] == "/a~1b~0/2"
    assert values == [-0.125, 9007199254740993]
    result = _parse_and_render(output("Дельта: {{number:0}}; бюджет: {{number:1}}."), values)
    assert result.general_assessment == "Дельта: -0.125; бюджет: 9007199254740993."


@pytest.mark.parametrize("raw", [
    output("Score: 99"), output("Score: ９９"), output("Score: ²"),
    output("Score: {{number:9}}"), output("Score: {{number:x}}"),
    output("Текст", extra_field=True), '{"general_assessment": "нет списков"}',
    '{"general_assessment":"a","general_assessment":"b",'
    '"strengths":[],"risks_and_penalties":[],"recommendations":[]}',
    output().replace('"strengths": []', '"strengths": "строка"'),
    output().replace('"strengths": []', '"strengths": [1]'),
    "```json\n" + output() + "\n```", "{", "[]",
])
def test_rejects_bad_outputs(raw):
    with pytest.raises(InvalidModelOutput):
        _parse_and_render(raw, [5])


@pytest.mark.parametrize("data", [{}, [], {1: 2}, {"x": float("nan")},
                                      {"x": float("inf")}, {"x": (1, 2)}])
def test_rejects_bad_input_before_request(data):
    async def run():
        p = FakeProvider()
        async with LLMRouter({"openai": p}) as router:
            with pytest.raises(ValueError):
                await router.assess(data, fallback=None)
        assert p.calls == 0
    asyncio.run(run())


@pytest.mark.parametrize("mode", ["json_schema", "json_object", "nvext"])
def test_real_sdk_request_and_response(mode):
    async def run():
        def handle(request):
            body = json.loads(request.content)
            assert request.url.path == "/v1/chat/completions"
            assert body["model"] == "test-model"
            assert body["messages"][0]["role"] == "system"
            assert json.loads(body["messages"][1]["content"])["calculator_result"] == {"remaining": 5}
            if mode == "nvext":
                assert body["nvext"]["guided_json"]["additionalProperties"] is False
            else:
                assert body["response_format"]["type"] == mode
                if mode == "json_schema":
                    assert body["response_format"]["json_schema"]["strict"] is True
            return httpx.Response(200, json=completion(output()))
        client = AsyncOpenAI(api_key="test-only", base_url="https://mock.local/v1",
                             max_retries=0,
                             http_client=httpx.AsyncClient(transport=httpx.MockTransport(handle)))
        p = OpenAICompatibleProvider(client, "test-model", mode)
        async with LLMRouter({"nvidia": p}) as router:
            result = await router.assess({"remaining": 5}, provider="nvidia", fallback=None)
            assert result == dict(general_assessment="Остаток бюджета: 5.",
                                  strengths=[], risks_and_penalties=[], recommendations=[])
        assert client.is_closed()
    asyncio.run(run())


@pytest.mark.parametrize("first", ["invalid", "timeout", "valid"])
def test_fallback_and_primary_success(first):
    async def run():
        primary = FakeProvider("oops" if first == "invalid" else output(),
                               delay=1 if first == "timeout" else 0)
        backup = FakeProvider()
        async with LLMRouter({"openai": primary, "nvidia": backup},
                             attempt_timeout=0.02, total_timeout=0.5) as router:
            result = await router.assess({"remaining": 5}, fallback="nvidia")
            assert result["general_assessment"] == "Остаток бюджета: 5."
        assert backup.calls == (0 if first == "valid" else 1)
        assert primary.closed and backup.closed
    asyncio.run(run())


@pytest.mark.parametrize("response", [
    httpx.Response(429, json={"error": {"message": "private error", "type": "rate_limit"}}),
    httpx.Response(503, json={"error": {"message": "private error"}}),
    httpx.Response(200, json=completion(output(), finish="length")),
    httpx.Response(200, json=completion(refusal="refused")),
    httpx.Response(200, json=completion("")),
    httpx.Response(200, json={"id": "test", "choices": []}),
])
def test_api_failures_fallback(response):
    async def run():
        client = AsyncOpenAI(api_key="test-only", max_retries=0,
                             http_client=httpx.AsyncClient(
                                 transport=httpx.MockTransport(lambda _: response)))
        backup = FakeProvider()
        async with LLMRouter({"openai": OpenAICompatibleProvider(client, "gpt-4o"),
                              "nvidia": backup}) as router:
            await router.assess({"remaining": 5}, fallback="nvidia")
        assert backup.calls == 1
    asyncio.run(run())


def test_all_failures_and_no_raw_text_in_error():
    async def run():
        router = LLMRouter({"openai": FakeProvider("private invalid text"),
                            "nvidia": FakeProvider("private invalid text")})
        with pytest.raises(AssessmentUnavailable) as info:
            await router.assess({"remaining": 5}, fallback="nvidia")
        assert [f.reason for f in info.value.failures] == ["invalid_output"] * 2
        assert "private" not in str(info.value)
    asyncio.run(run())


def test_total_timeout_and_cancellation():
    async def run():
        backup = FakeProvider()
        router = LLMRouter({"openai": FakeProvider(delay=1), "nvidia": backup},
                           attempt_timeout=1, total_timeout=0.02)
        with pytest.raises(AssessmentUnavailable):
            await router.assess({"remaining": 5})
        assert backup.calls == 0
        task = asyncio.create_task(router.assess({"remaining": 5}))
        await asyncio.sleep(0)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert backup.calls == 0
    asyncio.run(run())


def test_reverse_routing_and_missing_configuration():
    async def run():
        router = LLMRouter({"nvidia": FakeProvider("invalid"), "openai": FakeProvider()})
        assert await router.assess({"remaining": 5}, provider="nvidia", fallback="openai")
        with pytest.raises(ValueError, match="not configured"):
            await router.assess({"remaining": 5}, provider="missing")
    asyncio.run(run())


def test_openai_only_by_default():
    async def run():
        primary = FakeProvider()
        backup = FakeProvider()
        async with LLMRouter({"openai": primary, "nvidia": backup}) as router:
            result = await router.assess({"remaining": 5})
        assert result["general_assessment"] == "Остаток бюджета: 5."
        assert primary.calls == 1
        assert backup.calls == 0
    asyncio.run(run())


def test_env_factory(monkeypatch):
    for key in ("OPENAI_API_KEY", "NVIDIA_API_KEY", "OPENAI_MODEL", "NVIDIA_MODEL",
                "NVIDIA_OUTPUT_MODE", "NVIDIA_BASE_URL"):
        monkeypatch.delenv(key, raising=False)
    with pytest.raises(ValueError, match="at least one"):
        LLMRouter.from_env()
    monkeypatch.setenv("NVIDIA_API_KEY", "test-only")
    with pytest.raises(ValueError, match="NVIDIA_MODEL"):
        LLMRouter.from_env()
    monkeypatch.setenv("NVIDIA_MODEL", "test-nim")
    monkeypatch.setenv("OPENAI_API_KEY", "test-only")

    async def run():
        async with LLMRouter.from_env() as router:
            assert router.providers["openai"].model == "gpt-4o"
            assert router.providers["nvidia"].model == "test-nim"
            assert router.providers["nvidia"].client.max_retries == 0
    asyncio.run(run())
