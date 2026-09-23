"""Boundary tests: actual calculator -> real LLMRouter -> API response contract."""
import asyncio
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api import create_app
from llm_integration import LLMRouter

ROOT = Path(__file__).resolve().parents[1]
PLAN = json.loads((ROOT / 'examples/official_request.json').read_text())


class RecordingProvider:
    def __init__(self, mode='valid'):
        self.mode = mode
        self.inputs = []

    async def generate(self, payload):
        data = json.loads(payload)
        self.inputs.append(data['calculator_result'])
        if self.mode == 'timeout':
            await asyncio.sleep(1)
        token = next(f['token'] for f in data['numeric_facts'] if f['path'] == '/score/final')
        return json.dumps({
            'general_assessment': 'Итоговый Score: ' + (token if self.mode != 'invalid' else '99999'),
            'strengths': [], 'risks_and_penalties': [], 'recommendations': [],
        })

    async def aclose(self):
        pass


def client_with(provider):
    return TestClient(create_app(router=LLMRouter({'openai': provider}, attempt_timeout=.02), env_file=None, static_dir=None))


def test_catalog_matches_authoritative_dataset_and_plan():
    with TestClient(create_app(enable_ai=False, env_file=None, static_dir=None)) as client:
        catalog = client.get('/api/catalog').json()
        assert len(catalog['dataset']['measures']) == 14
        assert {d['id'] for d in catalog['dataset']['districts']} == {'esil', 'almaty', 'nura', 'saryarka', 'baikonur'}
        assert catalog['example_plan'] == PLAN
        assert catalog['max_per_category'] == 2
        assert catalog['ai_available'] is False
        assert set(catalog['metric_labels']) == set(catalog['rules']['metric_weights'])
        result = client.post('/api/simulate', json=catalog['example_plan'])
        assert result.status_code == 200
        assert result.json()['score']['final'] == 56.54307
        assert result.json()['budget']['spent'] == 95
        assert client.post('/simulate', json=PLAN).json() == result.json()


def test_analysis_uses_calculator_output_and_resolves_numeric_references():
    provider = RecordingProvider()
    with client_with(provider) as client:
        response = client.post('/api/analysis', json=PLAN)
        assert response.status_code == 200
        body = response.json()
        expected = client.post('/api/simulate', json=PLAN).json()
        assert provider.inputs == [expected]
        assert provider.inputs[0]['critical_threshold'] == 40
        assert body['simulation'] == expected
        assert body['assessment']['general_assessment'] == 'Итоговый Score: 56.54307'
        assert set(body['assessment']) == {'general_assessment', 'strengths', 'risks_and_penalties', 'recommendations'}


@pytest.mark.parametrize('change', ['fake_score', 'missing_district', 'duplicate', 'legacy_ids', 'conflict'])
def test_invalid_plan_never_reaches_llm(change):
    plan = json.loads(json.dumps(PLAN))
    if change == 'fake_score':
        plan['score'] = 100
    elif change == 'missing_district':
        del plan['district_assignments']['M7']
    elif change == 'duplicate':
        plan['measure_ids'][0] = 'M8'
    elif change == 'legacy_ids':
        plan['measure_ids'][0] = 'adaptive-lights'
    elif change == 'conflict':
        plan['measure_ids'] = ['M1', 'M3', 'M5', 'M10', 'M12']
        plan['district_assignments'] = {'M1': 'esil', 'M5': 'saryarka', 'M10': 'nura'}
    provider = RecordingProvider()
    with client_with(provider) as client:
        assert client.post('/api/analysis', json=plan).status_code == 422
        assert provider.inputs == []


@pytest.mark.parametrize('mode', ['invalid', 'timeout'])
def test_provider_failure_is_explicit_and_calculator_remains_available(mode):
    with client_with(RecordingProvider(mode)) as client:
        response = client.post('/api/analysis', json=PLAN)
        assert response.status_code == 503
        assert '99999' not in response.text
        assert client.post('/api/simulate', json=PLAN).status_code == 200


def test_missing_key_does_not_break_math(monkeypatch):
    monkeypatch.delenv('OPENAI_API_KEY', raising=False)
    with TestClient(create_app(env_file=None, static_dir=None)) as client:
        assert client.post('/api/analysis', json=PLAN).status_code == 503
        assert client.post('/api/simulate', json=PLAN).status_code == 200


def test_example_response_is_current():
    request = json.loads((ROOT / 'examples/request.json').read_text())
    expected = json.loads((ROOT / 'examples/response.json').read_text())
    with TestClient(create_app(enable_ai=False, env_file=None, static_dir=None)) as client:
        assert client.post('/api/simulate', json=request).json() == expected


def test_static_app_does_not_hide_missing_api_routes(tmp_path):
    (tmp_path / 'index.html').write_text('<h1>Simulator</h1>')
    with TestClient(create_app(enable_ai=False, env_file=None, static_dir=tmp_path)) as client:
        assert client.get('/').status_code == 200
        assert client.get('/api/not-found').status_code == 404
        assert client.get('/api/catalog').status_code == 200
