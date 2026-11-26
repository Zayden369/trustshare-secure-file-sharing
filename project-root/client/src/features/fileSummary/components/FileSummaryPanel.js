import React, { useState } from 'react';
import useFileSummary from '../hooks/useFileSummary';
import '../fileSummary.css';

export default function FileSummaryPanel({ file, onClose }) {
  const [options, setOptions] = useState({ summary_length: 'standard', output_language: 'original', output_format: 'paragraph', force_regenerate: false });
  const [copied, setCopied] = useState(false);
  const { summary, loading, error, retryAfter = 0, generate, regenerate, changeOptions } = useFileSummary(file.id || file.file_id);
  const isBulletSummary = summary?.output_format === 'bullet_points';
  const bulletItems = isBulletSummary
    ? (summary.summary_text?.split(/\n+/).map(line => line.replace(/^\s*[-•]\s*/, '').trim()).filter(Boolean) || [])
    : [];

  const copy = async () => {
    const value = [summary?.summary_text, ...(!isBulletSummary ? (summary?.key_points || []).map(point => `- ${point}`) : [])].filter(Boolean).join('\n\n');
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="summary-overlay" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className="summary-panel" role="dialog" aria-modal="true" aria-labelledby="summary-title">
        <header className="summary-header">
          <div><span className="summary-kicker">AI FILE SUMMARY</span><h2 id="summary-title">{file.original_name || file.name}</h2></div>
          <button type="button" className="summary-close" onClick={onClose} aria-label="Close file summary">&times;</button>
        </header>

        {!summary && !loading && (
          <form className="summary-options" onSubmit={event => { event.preventDefault(); generate(options); }}>
            <label>Summary length<select value={options.summary_length} onChange={event => setOptions({ ...options, summary_length: event.target.value })}><option value="short">Short</option><option value="standard">Standard</option><option value="detailed">Detailed</option></select></label>
            <label>Format<select value={options.output_format} onChange={event => setOptions({ ...options, output_format: event.target.value })}><option value="paragraph">Paragraph</option><option value="bullet_points">Bullet points</option></select></label>
            <p className="summary-privacy">Secure processing: your encrypted file is decrypted only in backend memory. External AI is disabled unless explicitly configured.</p>
            <button className="btn btn-primary" type="submit">Generate summary</button>
          </form>
        )}

        {loading && <div className="summary-state" role="status"><span className="spinner" /><h3>Generating your summary...</h3><p>The document is being securely extracted and processed.</p></div>}
        {error && <div className="summary-error" role="alert"><strong>Summary unavailable</strong><p>{error}{retryAfter > 0 && ` Please try again in ${retryAfter} seconds.`}</p><button className="btn btn-secondary btn-sm" disabled={retryAfter > 0} onClick={() => generate(options)}>{retryAfter > 0 ? `Try again in ${retryAfter}s` : 'Try again'}</button></div>}

        {summary?.status === 'failed' && <div className="summary-error" role="alert"><strong>Generation failed</strong><p>{summary.error_message}</p><button className="btn btn-secondary btn-sm" onClick={regenerate}>Try again</button></div>}
        {summary?.status === 'completed' && !loading && (
          <div className="summary-result">
            <div className="summary-meta"><span>{summary.cached ? `Cached · ${summary.provider || 'summary'}` : summary.provider}</span><span>{summary.summary_length} · {summary.output_format === 'bullet_points' ? 'Bullet points' : 'Paragraph'}</span><span>Version {summary.source_file_version}</span><span>{new Date(summary.generated_at || summary.updated_at).toLocaleString()}</span></div>
            {summary.warning_message && <div className="summary-warning">Warning: {summary.warning_message}</div>}
            <h3>{summary.title}</h3>
            {isBulletSummary ? <ul className="summary-main-bullets" aria-label="Summary">{bulletItems.map((point, index) => <li key={`${index}-${point}`}>{point}</li>)}</ul> : <p className="summary-text">{summary.summary_text}</p>}
            {!isBulletSummary && !!summary.key_points?.length && <><h4>Key points</h4><ul>{summary.key_points.map((point, index) => <li key={`${index}-${point}`}>{point}</li>)}</ul></>}
            {!!summary.keywords?.length && <div className="summary-keywords">{summary.keywords.map(word => <span key={word}>{word}</span>)}</div>}
            <div className="summary-actions"><button className="btn btn-secondary btn-sm" onClick={copy}>{copied ? 'Copied' : 'Copy summary'}</button><button className="btn btn-secondary btn-sm" onClick={changeOptions}>Change options</button><button className="btn btn-primary btn-sm" onClick={regenerate}>Regenerate</button></div>
          </div>
        )}
      </section>
    </div>
  );
}
