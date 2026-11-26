# Summary performance

The CPU deployment uses `SUMMARY_OLLAMA_MODEL=qwen2.5:0.5b` for file summaries and `SUMMARY_OLLAMA_THREADS=2`. This override does not change the assistant's model. If unset, the summary provider retains the existing `OLLAMA_MODEL` setting.

Ollama generates only the requested paragraph or bullet array through a constrained JSON schema. Keywords and paragraph supporting points are derived locally from the source. Exact repeated long sentences are removed from model input while the full extracted text remains available to the fallback. The model stays loaded for 30 minutes after use; another model, resource pressure or a restart can still cause a cold start.

Output bounds and explicit truncation rejection prevent incomplete model output from being saved as a successful summary. The existing extractive fallback remains available if inference fails. The frontend checks completion every 750 ms instead of adding up to two seconds after generation finishes.

## Measurements and limits

On 26 November 2026, isolated candidate requests on the existing t3.medium instance took 6.42 seconds (short lease bullets, including model load), 6.16 seconds (standard botany paragraph), 9.14 seconds (detailed project paragraph), and 5.09 seconds (repeated source text after deduplication). These were new inferences, not cached summaries, against synthetic documents. Earlier live API tests with the 1.5B model took 20–24 seconds.

These samples are not a latency guarantee. Large documents, simultaneous requests, assistant activity, cold model loading and CPU contention can exceed ten seconds. The 0.5B model can omit details or write less than the requested word range, especially for detailed summaries; verbatim supporting points retain additional source information. Length choices remain distinct instructions, not strict minimum word counts. Check important facts against the original document.

Long documents retain the existing bounded start/middle/end excerpt and its visible warning. The extractive fallback receives the full text. No paid AI provider or larger instance is needed for this configuration. For strict latency requirements across large documents and concurrent users, measure a larger evaluation set and consider faster inference infrastructure separately.

## Operations

Download the model into the existing Ollama volume before selecting it:

```sh
docker compose exec -T ollama ollama pull qwen2.5:0.5b
```

Set `SUMMARY_OLLAMA_MODEL=qwen2.5:0.5b` and `SUMMARY_OLLAMA_THREADS=2` in the backend runtime environment, then recreate the backend. Keep the existing assistant model and credentials unchanged. The two-thread setting is specific to the current two-vCPU server; omit it for automatic thread selection elsewhere.

To restore the previous inference model, remove `SUMMARY_OLLAMA_MODEL` (or set it to `qwen2.5:1.5b`) and recreate the backend. Existing completed summaries are reused; choose Regenerate to measure new inference. Model choices do not change cache keys or mix documents/accounts.
