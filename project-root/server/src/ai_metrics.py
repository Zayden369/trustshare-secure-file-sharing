"""Content-free, monotonic timings shared by both AI features."""
import contextvars
import json
import logging
import time
import uuid
from contextlib import contextmanager

logger = logging.getLogger("trustshare.ai.performance")
current_trace = contextvars.ContextVar("ai_trace", default=None)


class Trace:
    def __init__(self, operation):
        self.operation = operation
        self.request_id = uuid.uuid4().hex
        self.started = time.perf_counter()
        self.stages = {}
        self.counters = {"llm_calls": 0}

    @contextmanager
    def stage(self, name):
        started = time.perf_counter()
        try:
            yield
        finally:
            self.stages[name] = self.stages.get(name, 0) + (time.perf_counter() - started) * 1000

    def snapshot(self):
        return {"request_id": self.request_id, "operation": self.operation,
                "total_ms": round((time.perf_counter() - self.started) * 1000, 2),
                "stages_ms": {k: round(v, 2) for k, v in self.stages.items()},
                "counters": dict(self.counters)}

    def emit(self, status="completed"):
        logger.info(json.dumps({**self.snapshot(), "status": status}, separators=(",", ":")))


@contextmanager
def traced(operation):
    trace = Trace(operation)
    token = current_trace.set(trace)
    try:
        yield trace
    finally:
        current_trace.reset(token)


def record_inference(data, elapsed_ms, count_call=True):
    trace = current_trace.get()
    if not trace:
        return
    if count_call:
        trace.counters["llm_calls"] += 1
    for source, target in [("prompt_eval_count", "input_tokens"), ("eval_count", "output_tokens")]:
        if isinstance(data.get(source), (int, float)):
            trace.counters[target] = trace.counters.get(target, 0) + data[source]
    for source, target in [("load_duration", "model_load"), ("prompt_eval_duration", "prompt_evaluation"), ("eval_duration", "token_generation")]:
        if isinstance(data.get(source), (int, float)):
            trace.stages[target] = trace.stages.get(target, 0) + data[source] / 1_000_000
    trace.stages["inference_http"] = trace.stages.get("inference_http", 0) + elapsed_ms
