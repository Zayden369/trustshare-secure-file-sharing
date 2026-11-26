"""A bounded, cancellation-aware inference gate for the single-worker deployment.

Data-only assistant routes never acquire this gate. FIFO ordering prevents either
assistant requests or summaries from starving the other workload.
"""
import asyncio
import threading
import time
from collections import deque
from contextlib import contextmanager, asynccontextmanager


class InferenceBusy(RuntimeError):
    pass


class InferenceGate:
    def __init__(self, max_waiters=4):
        self.lock = threading.Lock()
        self.waiters = deque()
        self.active = False
        self.max_waiters = max_waiters

    def _join(self):
        ticket = object()
        with self.lock:
            if len(self.waiters) >= self.max_waiters:
                raise InferenceBusy("AI is busy. Please retry shortly.")
            self.waiters.append(ticket)
        return ticket

    def _take(self, ticket):
        with self.lock:
            if not self.active and self.waiters and self.waiters[0] is ticket:
                self.waiters.popleft()
                self.active = True
                return True
        return False

    def _leave(self, ticket, acquired):
        with self.lock:
            if acquired:
                self.active = False
            elif ticket in self.waiters:
                self.waiters.remove(ticket)

    @contextmanager
    def slot(self, timeout=30):
        ticket, acquired, started = self._join(), False, time.perf_counter()
        try:
            while not self._take(ticket):
                if time.perf_counter() - started >= timeout:
                    raise InferenceBusy("AI queue wait expired. Please retry shortly.")
                time.sleep(0.025)
            acquired = True
            from src.ai_metrics import current_trace
            trace = current_trace.get()
            if trace:
                trace.stages["queue_wait"] = trace.stages.get("queue_wait", 0) + (time.perf_counter() - started) * 1000
            yield
        finally:
            self._leave(ticket, acquired)

    @asynccontextmanager
    async def async_slot(self, timeout=30):
        ticket, acquired, started = self._join(), False, time.perf_counter()
        try:
            while not self._take(ticket):
                if time.perf_counter() - started >= timeout:
                    raise InferenceBusy("AI queue wait expired. Please retry shortly.")
                await asyncio.sleep(0.025)
            acquired = True
            from src.ai_metrics import current_trace
            trace = current_trace.get()
            if trace:
                trace.stages["queue_wait"] = trace.stages.get("queue_wait", 0) + (time.perf_counter() - started) * 1000
            yield
        finally:
            self._leave(ticket, acquired)


inference_gate = InferenceGate()
