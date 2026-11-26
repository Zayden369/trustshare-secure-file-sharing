import React, { useState } from 'react';
import FileArtwork from '../../../components/FileArtwork';
import {
  FileText, FileImage, FileVideo, FileAudio, FileArchive, FileSpreadsheet,
  File as FileIcon, Sparkles, Trash2, Download, Lock, LockOpen, Check, Play, Eye, History
} from 'lucide-react';

const AI_SUMMARY_EXTENSIONS = new Set([
  'txt', 'md', 'pdf', 'docx', 'pptx', 'csv', 'xlsx',
]);

const getExtension = (name = '') => {
  const parts = name.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
};

const supportsAISummary = (file) => AI_SUMMARY_EXTENSIONS.has(getExtension(file?.name || file?.original_name || ''));

const getFileIcon = (file) => {
  const mime = file?.mimetype || file?.file_type || '';
  const name = file?.name || file?.original_name || '';
  const ext = getExtension(name);
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return FileImage;
  if (mime.startsWith('video/') || ['mp4', 'webm', 'avi', 'mov', 'mkv'].includes(ext)) return FileVideo;
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return FileAudio;
  if (mime.includes('zip') || mime.includes('archive') || ['zip', 'tar', 'gz', '7z', 'rar'].includes(ext)) return FileArchive;
  if (['xlsx', 'xls', 'csv'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel')) return FileSpreadsheet;
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'pptx', 'ppt'].includes(ext) || mime.includes('pdf') || mime.includes('document')) return FileText;
  return FileIcon;
};

const getIconColor = (file) => {
  const ext = getExtension(file?.name || file?.original_name || '');
  const mime = file?.mimetype || '';
  if (mime.startsWith('image/')) return 'my-files-icon--image';
  if (mime.startsWith('video/')) return 'my-files-icon--video';
  if (mime.startsWith('audio/')) return 'my-files-icon--audio';
  if (['zip', 'tar', 'gz', '7z', 'rar'].includes(ext)) return 'my-files-icon--archive';
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'my-files-icon--spreadsheet';
  if (['pdf'].includes(ext)) return 'my-files-icon--pdf';
  if (['doc', 'docx', 'txt', 'md', 'pptx', 'ppt'].includes(ext)) return 'my-files-icon--document';
  return 'my-files-icon--default';
};

const getCleanCategory = (file) => {
  const ext = getExtension(file?.name || file?.original_name || '');
  if (ext) return ext.toUpperCase();
  const mime = file?.mimetype || '';
  if (mime.startsWith('image/')) return 'IMAGE';
  if (mime.startsWith('video/')) return 'VIDEO';
  if (mime.startsWith('audio/')) return 'AUDIO';
  if (mime.includes('pdf')) return 'PDF';
  if (mime.includes('spreadsheet') || mime.includes('excel')) return 'XLSX';
  if (mime.includes('presentation') || mime.includes('powerpoint')) return 'PPTX';
  if (mime.includes('word') || mime.includes('document')) return 'DOCX';
  if (mime.includes('zip') || mime.includes('archive')) return 'ZIP';
  return 'FILE';
};

const formatSize = (size) => {
  if (typeof size === 'string') return size;
  if (!size || isNaN(size)) return '0 B';
  if (size < 1024) return `${size} B`;
  if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1073741824) return `${(size / 1048576).toFixed(1)} MB`;
  return `${(size / 1073741824).toFixed(2)} GB`;
};

const isPreviewable = (file) => {
  const ext = getExtension(file?.name || file?.original_name || '');
  const mime = (file?.mimetype || '').toLowerCase();
  const previewSet = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg',
    'txt', 'md', 'json', 'xml', 'csv', 'log', 'pdf',
    'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac',
    'mp4', 'webm', 'avi', 'mov', 'mkv'
  ]);
  return previewSet.has(ext) || mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/') || mime.startsWith('text/');
};

export default function FileCard({
  file, onDelete, onDownload, onSummarize, onPreview, onVersionHistory, onPointerDragStart,
  viewMode = 'grid',
  selected = false,
  onToggleSelect,
  hasSelection = false,
  isHighlighted = false,
}) {
  const fileName = file?.name || file?.original_name || 'Untitled File';
  const category = getCleanCategory(file);
  const displaySize = formatSize(file?.size);
  const displayModified = file?.modified || file?.last_modified || (file?.created_at ? new Date(file.created_at).toLocaleDateString() : 'Recent');
  const isEncrypted = file?.encrypted !== false;
  const canSummarize = supportsAISummary(file);
  const versionNumber = file?.version || 1;
  const [isDragging, setIsDragging] = useState(false);

  const IconComponent = getFileIcon(file);
  const iconColorClass = getIconColor(file);

  const isPlayable = category === 'AUDIO' || category === 'VIDEO';
  const previewCapable = isPreviewable(file);

  const handleDragStart = (event) => {
    if (hasSelection && !selected) {
      event.preventDefault();
      return;
    }
    const dragPayload = selected
      ? { isBulk: true, name: 'Selected files' }
      : { id: file.id, name: fileName, isBulk: false };

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-trustshare-file', JSON.stringify(dragPayload));
    setIsDragging(true);
  };

  const handlePointerDown = (event) => {
    if (event.button !== 0 || event.target.closest('button, .my-files-select-toggle')) return;
    if (event.pointerType !== 'touch') return;
    onPointerDragStart?.({ id: file.id, name: fileName });
  };

  const handleCardClick = (event) => {
    if (event.target.closest('button, .my-files-select-toggle')) return;
    if (hasSelection && onToggleSelect) {
      onToggleSelect(file.id);
      return;
    }
    if (onPreview) onPreview(file);
  };

  const handleCheckboxClick = (e) => {
    e.stopPropagation();
    onToggleSelect?.(file.id);
  };

  // ══ LIST VIEW ══════════════════════════════════════════════════════════
  if (viewMode === 'list') {
    return (
      <article
        data-file-id={file.id}
        className={`my-files-list-row ${isDragging ? 'is-dragging' : ''} ${selected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
        draggable={!hasSelection || selected}
        onDragStart={handleDragStart}
        onDragEnd={() => setIsDragging(false)}
        onPointerDown={handlePointerDown}
        onClick={handleCardClick}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPreview?.(file)}
        role="button"
        tabIndex={0}
      >
        <button
          type="button"
          className={`my-files-select-toggle ${selected ? 'is-checked' : ''}`}
          onClick={handleCheckboxClick}
          aria-label={selected ? 'Deselect file' : 'Select file'}
        >
          {selected && <Check size={12} strokeWidth={3} />}
        </button>

        <div className={`my-files-list-icon my-files-icon-box ${iconColorClass}`}>
          <IconComponent size={16} strokeWidth={2} />
        </div>

        <div className="my-files-list-name" title={fileName}>
          {fileName}
          {versionNumber > 1 && (
            <span className="badge badge-blue" style={{ marginLeft: 8, fontSize: 10, padding: '1px 6px' }}>
              v{versionNumber}
            </span>
          )}
        </div>
        <div className="my-files-list-type">{category}</div>
        <div className="my-files-list-size">{displaySize}</div>
        <div className="my-files-list-date">{displayModified}</div>
        <div className="my-files-list-badge">
          {isEncrypted ? (
            <span className="my-files-encrypted-badge is-encrypted">
              <Lock size={10} strokeWidth={2.4} />
            </span>
          ) : (
            <span className="my-files-encrypted-badge">
              <LockOpen size={10} strokeWidth={2.4} />
            </span>
          )}
        </div>

        <div className="my-files-list-actions" onClick={(e) => e.stopPropagation()}>
          {onVersionHistory && (
            <button
              type="button"
              className="my-files-quick-btn"
              onClick={() => onVersionHistory(file)}
              title="Version History"
            >
              <History size={13} strokeWidth={2.2} />
            </button>
          )}
          {canSummarize && onSummarize && (
            <button
              type="button"
              className="my-files-quick-btn my-files-quick-btn--ai"
              onClick={() => onSummarize(file)}
              title="Generate AI Summary"
            >
              <Sparkles size={13} strokeWidth={2.2} />
            </button>
          )}
          {previewCapable && onPreview && (
            <button
              type="button"
              className="my-files-quick-btn"
              onClick={() => onPreview(file)}
              title={isPlayable ? "Play / Stream" : "Preview"}
            >
              {isPlayable ? <Play size={13} strokeWidth={2.2} /> : <Eye size={13} strokeWidth={2.2} />}
            </button>
          )}
          {onDownload && (
            <button
              type="button"
              className="my-files-quick-btn"
              onClick={() => onDownload(file)}
              title="Download"
            >
              <Download size={13} strokeWidth={2.2} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="my-files-quick-btn my-files-quick-btn--danger"
              onClick={() => onDelete(file.id)}
              title="Delete"
            >
              <Trash2 size={13} strokeWidth={2.2} />
            </button>
          )}
        </div>
      </article>
    );
  }

  // ══ GRID VIEW ══════════════════════════════════════════════════════════
  return (
    <article
      data-file-id={file.id}
      className={`my-files-card my-files-file-card group ${isDragging ? 'is-dragging' : ''} ${selected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
      draggable={!hasSelection || selected}
      onDragStart={handleDragStart}
      onDragEnd={() => setIsDragging(false)}
      onPointerDown={handlePointerDown}
      onClick={handleCardClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPreview?.(file)}
      role={onPreview ? 'button' : undefined}
      tabIndex={onPreview ? 0 : undefined}
      style={onPreview ? { cursor: 'pointer' } : undefined}
    >
      <button
        type="button"
        className={`my-files-select-toggle my-files-select-toggle--card ${selected ? 'is-checked' : ''}`}
        onClick={handleCheckboxClick}
        aria-label={selected ? 'Deselect file' : 'Select file'}
      >
        {selected && <Check size={12} strokeWidth={3} />}
      </button>

      <div className="my-files-card-top">
        <FileArtwork name={fileName} mimetype={file.mimetype}/>
        <div className="my-files-card-top-right">
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {versionNumber > 1 && (
              <span className="badge badge-blue" style={{ fontSize: 10, padding: '2px 6px' }}>
                v{versionNumber}
              </span>
            )}
            <span className="my-files-type-chip">{category}</span>
          </div>

          <div className="my-files-quick-actions" onClick={(e) => e.stopPropagation()}>
            {onVersionHistory && (
              <button
                type="button"
                className="my-files-quick-btn"
                onClick={() => onVersionHistory(file)}
                title="Version History"
              >
                <History size={14} strokeWidth={2.2} />
              </button>
            )}
            {canSummarize && onSummarize && (
              <button
                type="button"
                className="my-files-quick-btn my-files-quick-btn--ai"
                onClick={() => onSummarize(file)}
                title="Generate AI Summary"
              >
                <Sparkles size={14} strokeWidth={2.2} />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className="my-files-quick-btn my-files-quick-btn--danger"
                onClick={() => onDelete(file.id)}
                title="Delete file"
              >
                <Trash2 size={14} strokeWidth={2.2} />
              </button>
            )}
          </div>
        </div>
      </div>

      <h3 className="my-files-card-title" title={fileName}>{fileName}</h3>

      <div className="my-files-card-meta">
        <span>{displaySize}</span>
        <span className="my-files-meta-sep">·</span>
        <span>{displayModified}</span>
      </div>

      <div className="my-files-card-footer" onClick={(e) => e.stopPropagation()}>
        <span className={`my-files-encrypted-badge ${isEncrypted ? 'is-encrypted' : ''}`}>
          {isEncrypted ? (
            <><Lock size={11} strokeWidth={2.4} /> Encrypted</>
          ) : (
            <><LockOpen size={11} strokeWidth={2.4} /> Unencrypted</>
          )}
        </span>

        {previewCapable ? (
          <button
            type="button"
            className="my-files-download-btn"
            style={{ color: 'var(--blue-400)', background: 'rgba(128, 128, 128, 0.08)', borderColor: 'rgba(128, 128, 128, 0.15)' }}
            onClick={() => onPreview(file)}
          >
            {category === 'AUDIO' ? (
              <><Play size={12} strokeWidth={2.4} /> Play</>
            ) : category === 'VIDEO' ? (
              <><Play size={12} strokeWidth={2.4} /> Watch</>
            ) : (
              <><Eye size={12} strokeWidth={2.4} /> View</>
            )}
          </button>
        ) : (
          onDownload && (
            <button
              type="button"
              className="my-files-download-btn"
              onClick={() => onDownload(file)}
            >
              <Download size={12} strokeWidth={2.4} />
              Download
            </button>
          )
        )}
      </div>
    </article>
  );
}
