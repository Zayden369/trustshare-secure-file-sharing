import React, { useRef, useState } from 'react';
import { Folder, Trash2, Pencil } from 'lucide-react';
import '../../../components/file-artwork.css';

export default function FolderCard({
  id, title, subtitle,
  onDelete, onRename, onOpen, onFileDrop, pointerDraggedFile,
  viewMode = 'grid',
}) {
  const [isDropTarget, setIsDropTarget] = useState(false);
  const suppressClickRef = useRef(false);

  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setIsDropTarget(true);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDropTarget(false);
    try {
      const payload = JSON.parse(event.dataTransfer.getData('application/x-trustshare-file'));
      if (payload) {
        onFileDrop?.({ id, name: title }, payload);
      }
    } catch {}
  };

  const handlePointerUp = (event) => {
    if (!pointerDraggedFile) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = true;
    window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    setIsDropTarget(false);
    onFileDrop?.({ id, name: title }, pointerDraggedFile);
  };

  const handleOpen = () => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    onOpen?.({ id, name: title });
  };

  // ══ LIST VIEW ══════════════════════════════════════════════════════════
  if (viewMode === 'list') {
    return (
      <article
        className={`my-files-list-row my-files-list-row--folder ${isDropTarget ? 'is-drop-target' : ''}`}
        onClick={handleOpen}
        onKeyDown={(event) => event.key === 'Enter' && onOpen?.({ id, name: title })}
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setIsDropTarget(false);
        }}
        onDrop={handleDrop}
        onPointerEnter={() => pointerDraggedFile && setIsDropTarget(true)}
        onPointerLeave={() => pointerDraggedFile && setIsDropTarget(false)}
        onPointerUp={handlePointerUp}
        role="button"
        tabIndex={0}
      >
        <div /> {/* checkbox column spacer */}
        <div className="my-files-list-icon my-files-icon-box my-files-icon--folder">
          <Folder size={16} strokeWidth={2} />
        </div>
        <div className="my-files-list-name" title={title}>{title}</div>
        <div className="my-files-list-type">FOLDER</div>
        <div className="my-files-list-size">—</div>
        <div className="my-files-list-date">{subtitle}</div>
        <div className="my-files-list-badge" />
        <div className="my-files-list-actions">
          {onRename && id && (
            <button
              type="button"
              className="my-files-quick-btn my-files-quick-btn--edit"
              onClick={(event) => { event.stopPropagation(); onRename(id, title); }}
              title="Rename folder"
            >
              <Pencil size={13} strokeWidth={2.2} />
            </button>
          )}
          {onDelete && id && (
            <button
              type="button"
              className="my-files-quick-btn my-files-quick-btn--danger"
              onClick={(event) => { event.stopPropagation(); onDelete(id); }}
              title="Delete folder"
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
      className={`my-files-card my-files-folder-card group ${isDropTarget ? 'is-drop-target' : ''}`}
      onClick={handleOpen}
      onKeyDown={(event) => event.key === 'Enter' && onOpen?.({ id, name: title })}
      onDragEnter={handleDragOver}
      onDragOver={handleDragOver}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setIsDropTarget(false);
      }}
      onDrop={handleDrop}
      onPointerEnter={() => pointerDraggedFile && setIsDropTarget(true)}
      onPointerLeave={() => pointerDraggedFile && setIsDropTarget(false)}
      onPointerUp={handlePointerUp}
      role="button"
      tabIndex={0}
    >
      <div className="my-files-card-top">
        <div className="folder-artwork" aria-hidden="true">
          <svg viewBox="0 0 88 68"><path d="M5 14h29l8 9h40v40H5z"/><path d="M5 27h77l-8 36H5z"/><path d="M13 36h54M13 42h38"/></svg>
        </div>
        <div className="my-files-card-top-right">
          <span className="my-files-type-chip">Folder</span>
          {(onRename || onDelete) && id && (
            <div className="my-files-quick-actions">
              {onRename && (
                <button
                  type="button"
                  className="my-files-quick-btn my-files-quick-btn--edit"
                  onClick={(event) => { event.stopPropagation(); onRename(id, title); }}
                  title="Rename folder"
                  aria-label="Rename folder"
                >
                  <Pencil size={14} strokeWidth={2.2} />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  className="my-files-quick-btn my-files-quick-btn--danger"
                  onClick={(event) => { event.stopPropagation(); onDelete(id); }}
                  title="Delete folder"
                  aria-label="Delete folder"
                >
                  <Trash2 size={14} strokeWidth={2.2} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <h3 className="my-files-card-title">{title}</h3>
      <p className="my-files-card-meta">{subtitle}</p>
    </article>
  );
}
