# AI architecture investigation and baseline

Base: `8e7aa3be9b5681f4a0f3206de29ec99ac5227d0c`. Work is isolated on `optimization/ai-performance-architecture`; the original working tree contains unrelated runtime changes and remains intact. No production deployment or merge is part of this development phase.

## Confirmed root causes

- `assistant/chat_service.py`: all questions enter a five-iteration tool loop, followed by synchronous title inference for new conversations. Prior conversation messages are not included.
- `assistant/llm_client.py`: each call opens an HTTP connection, sends every active tool, and logs provider response bodies on errors. Stop in `hooks/useChat.js` only clears a UI flag.
- `assistant/functions.py`: file classification and limits happen after `.all()`, largest-file sorting and calendar-month filters are absent, and sessions include historical rows. Function metadata permissions are not checked by the executor.
- `file_summaries/service.py`: current cache scopes file/version/checksum/length/language/format and rechecks permission on reads. Input deduplication, bounded excerpts, fallback recovery and explicit warnings must remain. There are no stage timings, generation-policy identity or stale-worker recovery.
- `file_summaries/text_extraction.py`: DOCX paragraphs omit table cells, and PowerPoint tables are omitted.

## Existing deployment and measurements

Existing instance: t3.medium, two virtual CPUs, one physical core, approximately 3.8 GiB RAM, one backend worker. The assistant's actual database configuration remains Ollama `qwen2.5:1.5b`, with five allowed tool-loop iterations. The dedicated summary override is `qwen2.5:0.5b`, two threads. Those optimizations are retained, not presented as new work here.

On 26 November 2026, the unmodified deployed assistant was measured in a separate process using a synthetic member account with empty data. No real document or private account content was used. The account was disabled afterward. These measurements include orchestration and persistence, but exclude HTTP transport and JWT validation:

| Query | Conversation | Total | LLM calls | Individual inference times |
|---|---|---:|---:|---|
| How much storage do I have left? | New | 55.176 s | 3 | 44.816 s, 7.947 s, 2.361 s |
| Show my active login sessions | Existing | 8.252 s | 2 | 4.015 s, 4.208 s |

The first sample was cold relative to the assistant workload, but the baseline's OpenAI-compatible endpoint does not report separate model-load duration. Do not attribute all 44.816 seconds to loading. Two samples are an exploratory baseline, not a statistically reliable p95. Previous fresh summary API measurements were 2.6–5.8 seconds on small synthetic documents; isolated candidate samples were 5.09–9.14 seconds. None is a universal latency guarantee.

## Planned implementation and validation

1. Content-free monotonic tracing; repeatable synthetic baseline/evaluation fixtures.
2. Conservative exact intent routing, live authorized SQL data, verified product facts and immediate deterministic titles.
3. Real authenticated SSE, upstream cancellation, bounded history/tools/deadlines, safe retries and atomic turn completion.
4. Summary stage metrics, policy-aware cache handling, job recovery, structured output validation and source coverage tests; no plaintext extraction cache.
5. Single-worker bounded inference scheduling, repeated performance/quality/privacy tests, a normal frontend build and local browser review.

No paid provider, larger instance or new public resource is required. Performance targets remain targets; report missed targets and quality tradeoffs rather than using timeouts or fallbacks as successful AI benchmarks.
