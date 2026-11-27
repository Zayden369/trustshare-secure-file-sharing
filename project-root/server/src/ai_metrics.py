"""Content-free, monotonic timings shared by both AI features."""
import contextvars
import json
import logging
import time
import uuid
from contextlib import contextmanager
from sqlalchemy import event
from sqlalchemy.engine import Engine

logger = logging.getLogger("trustshare.ai.performance")
if not logger.handlers:
    handler=logging.StreamHandler()
    handler.setFormatter(logging.Formatter('%(message)s'))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)
logger.propagate=False
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
    parent=current_trace.get()
    trace = Trace(operation)
    if parent and parent.operation.endswith('_http') and operation in {'assistant','summary_request'}:
        parent.stages['validation_dispatch'] = max(0,(trace.started-parent.started)*1000-parent.stages.get('authorization',0))
    token = current_trace.set(trace)
    try:
        yield trace
    finally:
        current_trace.reset(token)
        if parent and operation!='summary_generation':
            for name,value in trace.stages.items():
                parent.stages['engine.'+name]=parent.stages.get('engine.'+name,0)+value
            for name,value in trace.counters.items():
                if isinstance(value,(float,int)):
                    parent.counters[name]=parent.counters.get(name,0)+value


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


@event.listens_for(Engine,'before_cursor_execute')
def _query_started(conn,cursor,statement,parameters,context,executemany):
    context._ai_trace=current_trace.get()
    if context._ai_trace:
        context._ai_started=time.perf_counter()


@event.listens_for(Engine,'after_cursor_execute')
def _query_finished(conn,cursor,statement,parameters,context,executemany):
    trace=getattr(context,'_ai_trace',None)
    if trace:
        trace.stages['database_queries']=trace.stages.get('database_queries',0)+(time.perf_counter()-context._ai_started)*1000
        trace.counters['database_queries']=trace.counters.get('database_queries',0)+1


class AIMetricsMiddleware:
    def __init__(self,app):self.app=app

    async def __call__(self,scope,receive,send):
        path=scope.get('path','')
        operation=('assistant_http' if path.startswith('/api/assistant/chat') else
                   'summary_http' if path.startswith('/api/files/') and '/summaries' in path else None)
        if scope.get('type')!='http' or not operation:
            return await self.app(scope,receive,send)
        with traced(operation) as trace:
            scope['ai_trace']=trace
            sent=False
            async def measured_send(message):
                nonlocal sent
                if message['type']=='http.response.start':
                    trace.counters['http_status']=message['status']
                    trace.stages['response_headers']=(time.perf_counter()-trace.started)*1000
                if message['type']=='http.response.body' and not message.get('more_body',False):
                    trace.stages['http_response']=(time.perf_counter()-trace.started)*1000
                    trace.emit('response_sent');sent=True
                await send(message)
            try:
                await self.app(scope,receive,measured_send)
            finally:
                if not sent:trace.emit('interrupted')
