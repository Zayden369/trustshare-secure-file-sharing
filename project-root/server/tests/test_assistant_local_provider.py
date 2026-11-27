import pytest
from src.assistant import config_service


@pytest.mark.parametrize('enabled,provider,base,key,expected', [
    (True, 'ollama', 'http://ollama:11434/v1', None, True),
    (True, 'ollama', '', None, False),
    (False, 'ollama', 'http://ollama:11434/v1', None, False),
    (True, 'groq', 'https://api.groq.com/openai/v1', None, False),
    (True, 'groq', 'https://api.groq.com/openai/v1', 'synthetic-test-key', True),
])
def test_provider_specific_readiness(monkeypatch, enabled, provider, base, key, expected):
    values={'ENABLE_ASSISTANT':enabled,'LLM_PROVIDER':provider,'LLM_BASE_URL':base,'LLM_API_KEY':key}
    monkeypatch.setattr(config_service, 'get', lambda db,name,default=None: values.get(name,default))
    assert config_service.is_assistant_configured(None) is expected
