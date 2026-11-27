# Summary depth and deployment parity

The deployed summary could repeat a short paragraph for Standard and Detailed because paragraph length was only a prompt suggestion with an upper character limit. Legacy saved summaries without a generation job were also treated as valid current cache entries.

## Behavior

- Ollama returns structured arrays of 2, 4 or 6 distinct content units for Short, Standard or Detailed. Paragraph units are joined as prose; bullet units become exactly one bullet each. Embedded line breaks and nested list markers are normalized.
- Brief sources cap the requested unit count to available source units and explain the limitation instead of padding the answer.
- The job checks whether a complete answer repeats another length option for the same file version, checksum, language, layout and current policy. Repeated output uses a clearly labelled extractive fallback when enabled. This adds no model retry.
- Policy `summary-depth-v6` invalidates older generated caches, including entries without jobs. Regeneration snapshots the earlier result. Historical results remain available and are labelled as earlier settings.
- Numeric metric lines survive sentence extraction. Conservative validation rejects new quantities, changed numeric time/percentage units, negated positive labelled counts, and affirmative reversals of explicit source qualifications. These checks are not semantic fact verification.
- A single model request still generates each summary. The existing model, inference scheduler, encrypted storage, account sessions and external-AI policy are preserved.

## Verification before deployment

- 104 affected backend summary, recovery, AI architecture/transport, local-provider and notification tests passed.
- 7 PostgreSQL concurrency tests passed using a disposable test schema.
- 12 focused frontend panel/hook tests passed; the production client build passed.
- A broader run found 17 failures in older assistant-auth and notification-generation tests. The same 17 failures were reproduced on unchanged main; they are not attributed to this summary fix.
- `scripts/benchmark_summary_depth.py` ran both synthetic security and resume documents through all six native Ollama options without using a cache. All 12 final local requests used Ollama, returned distinct answers across lengths and passed the 2/4/6 content-unit/layout checks.

| Synthetic case | Paragraph words: short / standard / detailed | Bullet words: short / standard / detailed |
| --- | --- | --- |
| Security report | 27 / 44 / 74 | 30 / 47 / 103 |
| Resume | 38 / 69 / 77 | 25 / 52 / 123 |

Local elapsed inference times were 2.423–5.441 seconds on the existing local runtime. This does not establish the same latency on the smaller EC2 CPU. Word targets are advisory; the distinct structured-unit count is enforced. Small-model phrasing and factual coverage remain imperfect, and failed validation continues to use the explicitly identified fallback.

Reproduce on synthetic data with:

```sh
PYTHONPATH=. SUMMARY_OLLAMA_THREADS=2 python scripts/benchmark_summary_depth.py \
  --url http://localhost:11434 --output /tmp/summary-depth.json
```

Add `--allow-fallback` to evaluate delivered native-or-fallback behavior; the artifact records the actual provider and native rejection reason separately. No account documents, passwords or tokens belong in public benchmark artifacts.

Deployment is to the existing service, with a database backup and application rollback. Public HTTPS verification must repeat all six choices on two disposable documents, verify the current policy, history, cache, ownership isolation, uploads/download metrics, login, Google callback and existing SMTP TLS authentication. Deployment results are retained privately with the release record.
