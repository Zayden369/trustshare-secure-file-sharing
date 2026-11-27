import asyncio
import json
import threading
import pytest
import httpx
from src.assistant.llm_client import LLMClient, LLMAPIError
from src.ai_metrics import traced
from src.ai_scheduler import InferenceGate, InferenceBusy


def client():
    value=object.__new__(LLMClient)
    value.provider='ollama';value.model='synthetic-model';value.base_url='http://test/v1'
    value.api_key=None;value.max_tokens=256;value.temperature=0.2;value.timeout=10
    return value


def test_native_tokens_arrive_before_completion_and_upstream_closes_on_cancel():
    closed=[];advanced=[]
    class Stream(httpx.AsyncByteStream):
        async def __aiter__(self):
            yield b'{"message":{"content":"First token"},"done":false}\n'
            advanced.append(True)
            await asyncio.sleep(20)
        async def aclose(self):closed.append(True)
    async def handler(request):return httpx.Response(200,stream=Stream())
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
            with traced('test') as trace:
                engine=client().stream_chat(http,[{'role':'user','content':'Hello'}])
                first=await anext(engine)
                assert first=={'type':'delta','text':'First token'} and not advanced
                await engine.aclose()
                assert trace.counters['llm_calls']==1
    asyncio.run(run())
    assert closed


def test_ollama_timings_are_recorded_without_content():
    class Stream(httpx.AsyncByteStream):
        async def __aiter__(self):
            yield b'{"message":{"content":"Synthetic secret text"},"done":false}\n'
            yield b'{"message":{"content":""},"done":true,"eval_count":5,"prompt_eval_count":12,"load_duration":1000000,"eval_duration":2000000}\n'
    async def handler(request):return httpx.Response(200,stream=Stream())
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
            with traced('test') as trace:
                events=[event async for event in client().stream_chat(http,[{'role':'user','content':'Hello'}])]
                assert events[-1]['type']=='round_done'
                value=trace.snapshot()
                assert value['counters']['llm_calls']==1
                assert value['counters']['output_tokens']==5
                assert value['stages_ms']['model_load']==1
                assert 'Synthetic secret text' not in json.dumps(value)
    asyncio.run(run())


def test_interrupted_native_stream_is_not_a_completed_reply():
    class Stream(httpx.AsyncByteStream):
        async def __aiter__(self):yield b'{"message":{"content":"Partial"},"done":false}\n'
    async def handler(request):return httpx.Response(200,stream=Stream())
    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
            with pytest.raises(LLMAPIError):
                [event async for event in client().stream_chat(http,[{'role':'user','content':'Hello'}])]
    asyncio.run(run())


def test_inference_gate_bounds_queue_and_cancelled_waiter_does_not_steal_a_slot():
    gate=InferenceGate(max_waiters=1)
    async def run():
        with gate.slot():
            async def wait():
                async with gate.async_slot():return 'acquired'
            task=asyncio.create_task(wait());await asyncio.sleep(0.03)
            with pytest.raises(InferenceBusy):
                with gate.slot():pass
            task.cancel()
            with pytest.raises(asyncio.CancelledError):await task
        async with gate.async_slot():pass
        assert not gate.active and not gate.waiters
    asyncio.run(run())
