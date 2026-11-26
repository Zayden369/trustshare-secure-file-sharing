import React, { useEffect, useState, useRef } from 'react';
import { filesAPI, foldersAPI } from '../utils/api';
import { events, EVENTS } from '../utils/events';
import FileSummaryPanel from '../features/fileSummary/components/FileSummaryPanel';
import { FileText, FileImage, FileVideo, FileAudio, FileArchive, FileSpreadsheet } from 'lucide-react';

const FILE_ICON = (mime = '') => {
  if (mime.startsWith('image/')) return { icon: <FileImage size={22}/>, color: '#808080' };
  if (mime.startsWith('video/')) return { icon: <FileVideo size={22}/>, color: '#808080' };
  if (mime.startsWith('audio/')) return { icon: <FileAudio size={22}/>, color: '#808080' };
  if (mime.includes('pdf'))      return { icon: <FileText size={22}/>, color: '#808080' };
  if (mime.includes('zip'))      return { icon: <FileArchive size={22}/>, color: '#808080' };
  if (mime.includes('spreadsheet') || mime.includes('excel')) return { icon: <FileSpreadsheet size={22}/>, color: '#808080' };
  return { icon: <FileText size={22}/>, color: '#808080' };
};

const fmt = (bytes) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

export default function Files() {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [viewMode, setViewMode] = useState('list'); // list | grid
  const [search, setSearch] = useState('');
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [folderPath, setFolderPath] = useState([]);
  const [toast, setToast] = useState(null);
  const [summaryFile, setSummaryFile] = useState(null);
  const inputRef = useRef();

  const activeFolder = folderPath[folderPath.length - 1];

  const load = () => {
    setLoading(true);
    Promise.all([filesAPI.list(activeFolder?.id), foldersAPI.list(activeFolder?.id)])
      .then(([f, fo]) => { setFiles(f.data.files); setFolders(fo.data); })
      .finally(() => setLoading(false));
  };

  useEffect(load, [activeFolder?.id]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleUpload = async (filesToUpload) => {
    if (!filesToUpload?.length) return;
    setUploading(true); setUploadPct(0);
    try {
      for (const file of filesToUpload) {
        const fd = new FormData();
        fd.append('file', file);
        await filesAPI.upload(fd, pct => setUploadPct(pct), activeFolder?.id);
      }
      showToast(`${filesToUpload.length} file(s) uploaded successfully!`);
      events.emit(EVENTS.STORAGE_CHANGED);
      load();
    } catch (e) {
      showToast(e.response?.data?.detail || 'Upload failed', 'error');
    } finally { setUploading(false); setShowUpload(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Move this file to trash?')) return;
    try { await filesAPI.delete(id); showToast('File deleted');  events.emit(EVENTS.STORAGE_CHANGED); load(); }
    catch { showToast('Delete failed', 'error'); }
  };

  const handleDownload = async (file) => {
    try {
      const res = await filesAPI.download(file.id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = file.original_name; a.click();
      URL.revokeObjectURL(url);
    } catch { showToast('Download failed', 'error'); }
  };

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;
    try { await foldersAPI.create(folderName.trim(), activeFolder?.id); showToast('Folder created'); setFolderName(''); setShowNewFolder(false); load(); }
    catch { showToast('Failed to create folder', 'error'); }
  };

  const openFolder = (folder) => {
    setFolderPath((current) => [...current, folder]);
    setSearch('');
    setSelected(null);
  };

  const goToFolder = (index) => {
    setFolderPath((current) => current.slice(0, index + 1));
    setSearch('');
    setSelected(null);
  };

  const handleDeleteFolder = async (folder) => {
    if (!window.confirm(`Delete folder "${folder.name}"? It must be empty first.`)) return;
    try {
      await foldersAPI.delete(folder.id);
      showToast('Folder deleted');
      load();
    } catch (error) {
      showToast(error.response?.data?.detail || 'Folder could not be deleted', 'error');
    }
  };

  const filtered = files.filter(f => f.original_name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fade-in">
      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`} style={{ position: 'fixed', top: 80, right: 24, zIndex: 9999, pointerEvents: 'none' }}>
          <div className="toast-msg">{toast.type === 'error' ? '❌' : '✅'} {toast.msg}</div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 800 }}>File Manager</h1>
          <div className="flex items-center gap-1 text-muted text-sm mt-1" aria-label="Folder path">
            <button className="btn btn-ghost btn-sm" onClick={() => setFolderPath([])}>My Files</button>
            {folderPath.map((folder, index) => (
              <React.Fragment key={folder.id}>
                <span>&gt;</span>
                <button className="btn btn-ghost btn-sm" onClick={() => goToFolder(index)}>{folder.name}</button>
              </React.Fragment>
            ))}
          </div>
          <p className="text-muted text-sm mt-1">{files.length} files · {folders.length} folders</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => setShowNewFolder(true)}>📁 New Folder</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowUpload(true)}>⬆️ Upload</button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card flex items-center gap-3 mb-4" style={{ padding: '12px 16px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>🔍</span>
          <input className="form-input" placeholder="Search files…" value={search}
            onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 38 }} />
        </div>
        <div className="flex gap-1">
          <button className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setViewMode('list')}>≡</button>
          <button className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setViewMode('grid')}>⊞</button>
        </div>
      </div>

      {/* Upload Zone */}
      {showUpload && (
        <div className={`upload-zone mb-4 ${dragging ? 'drag' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleUpload(Array.from(e.dataTransfer.files)); }}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" multiple hidden onChange={e => handleUpload(Array.from(e.target.files))} />
          {uploading ? (
            <div>
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>⬆️</div>
              <div style={{ fontWeight: 600, marginBottom: 12 }}>Uploading… {uploadPct}%</div>
              <div className="progress-bar" style={{ width: 200, margin: '0 auto' }}>
                <div className="progress-fill" style={{ width: `${uploadPct}%` }} />
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>📂</div>
              <div style={{ fontWeight: 700, fontSize: '1.0625rem', marginBottom: 8 }}>Drop files here or click to browse</div>
              <div className="text-sm text-muted">All files encrypted at rest with AES-256</div>
              <button className="btn btn-primary btn-sm mt-3" onClick={e => { e.stopPropagation(); setShowUpload(false); }}>Close</button>
            </>
          )}
        </div>
      )}

      {/* New Folder Dialog */}
      {showNewFolder && (
        <div className="card mb-4" style={{ padding: '16px 20px', borderColor: 'var(--border-accent)' }}>
          <div style={{ fontWeight: 700, marginBottom: 12 }}>📁 Create New Folder</div>
          <div className="flex gap-2">
            <input className="form-input" placeholder="Folder name…" value={folderName}
              onChange={e => setFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateFolder()} style={{ flex: 1 }} autoFocus />
            <button className="btn btn-primary btn-sm" onClick={handleCreateFolder}>Create</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setShowNewFolder(false); setFolderName(''); }}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}><div className="spinner" /></div>
      ) : (
        <>
          {/* Folders */}
          {folders.length > 0 && (
            <div className="mb-4">
              <div style={{ fontSize: '.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>FOLDERS</div>
              <div className="grid-4" style={{ gap: 10 }}>
                {folders.map(fo => (
                  <div key={fo.id} className="card flex items-center gap-3" style={{ padding: '12px 14px', cursor: 'pointer' }} onClick={() => openFolder(fo)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && openFolder(fo)}>
                    <span style={{ fontSize: '1.5rem' }}>📁</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="truncate" style={{ fontWeight: 600, fontSize: '.9375rem' }}>{fo.name}</div>
                      <div className="text-xs text-muted">Folder</div>
                    </div>
                    <button className="btn btn-ghost btn-icon" style={{ opacity: .5, fontSize: '.8125rem' }}
                      onClick={e => { e.stopPropagation(); handleDeleteFolder(fo); }}>🗑️</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          <div>
            <div style={{ fontSize: '.8125rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>
              FILES {search && `— "${search}"`}
            </div>

            {filtered.length === 0 ? (
              <div className="card text-center" style={{ padding: '48px 24px' }}>
                <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>📂</div>
                <div style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: 8 }}>{search ? 'No files match' : 'No files yet'}</div>
                <p className="text-secondary text-sm mb-4">Upload your first file to get started</p>
                <button className="btn btn-primary btn-sm" onClick={() => setShowUpload(true)}>⬆️ Upload File</button>
              </div>
            ) : viewMode === 'list' ? (
              <div className="card" style={{ overflow: 'hidden' }}>
                {/* Header row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 120px', padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', fontSize: '.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  <span>Name</span><span>Size</span><span>Type</span><span>Actions</span>
                </div>
                {filtered.map(f => {
                  const { icon, color } = FILE_ICON(f.mimetype);
                  return (
                    <div key={f.id} className="file-item"
                      style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 120px', padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', borderRadius: 0 }}
                      onClick={() => setSelected(selected?.id === f.id ? null : f)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="file-icon" style={{ background: `${color}15`, color, width: 36, height: 36, fontSize: '1.125rem' }}>{icon}</div>
                        <div>
                          <div className="file-name" style={{ maxWidth: 260 }}>{f.original_name}</div>
                          {f.encrypted && <span className="badge badge-emerald" style={{ fontSize: '.625rem', padding: '1px 6px' }}>🔐 Encrypted</span>}
                        </div>
                      </div>
                      <span className="text-muted text-sm" style={{ alignSelf: 'center' }}>{fmt(f.size)}</span>
                      <span className="text-muted text-xs" style={{ alignSelf: 'center' }}>{f.mimetype?.split('/')[1]?.toUpperCase() || 'FILE'}</span>
                      <div className="file-actions" style={{ opacity: 1, alignSelf: 'center' }}>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Generate AI Summary" aria-label={`Generate AI summary for ${f.original_name}`} onClick={e => { e.stopPropagation(); setSummaryFile(f); }}>✨</button>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Download" onClick={e => { e.stopPropagation(); handleDownload(f); }}>⬇️</button>
                        <button className="btn btn-ghost btn-icon btn-sm" title="Delete" onClick={e => { e.stopPropagation(); handleDelete(f.id); }}>🗑️</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid-4" style={{ gap: 14 }}>
                {filtered.map(f => {
                  const { icon, color } = FILE_ICON(f.mimetype);
                  return (
                    <div key={f.id} className="card card-pad" style={{ cursor: 'pointer', textAlign: 'center' }}>
                      <div style={{ width: 52, height: 52, borderRadius: 12, background: `${color}15`, color, fontSize: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>{icon}</div>
                      <div className="truncate font-semibold text-sm mb-1">{f.original_name}</div>
                      <div className="text-xs text-muted mb-3">{fmt(f.size)}</div>
                      {f.encrypted && <span className="badge badge-emerald" style={{ fontSize: '.625rem' }}>🔐</span>}
                      <div className="flex gap-1 justify-center mt-3">
                        <button className="btn btn-ghost btn-icon btn-sm" title="Generate AI Summary" aria-label={`Generate AI summary for ${f.original_name}`} onClick={() => setSummaryFile(f)}>✨</button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDownload(f)}>⬇️</button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDelete(f.id)}>🗑️</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
      {summaryFile && <FileSummaryPanel file={summaryFile} onClose={() => setSummaryFile(null)} />}
    </div>
  );
}
