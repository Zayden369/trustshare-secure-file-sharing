import React, { useMemo, useState, useEffect } from 'react';
import {
  Search, Eye, Download, Sparkles, ShieldCheck,
  LayoutGrid, List, UsersRound, Play
} from 'lucide-react';
import { formatDate } from '../../../utils/formatDate';
import SharedFileIcon from './SharedFileIcon';
import FileSummaryPanel from '../../fileSummary/components/FileSummaryPanel';
import FilePreviewModal from '../../myFiles/components/FilePreviewModal';
import { useLocation } from 'react-router-dom';

const SUMMARY_SUPPORTED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'pptx', 'ppt', 'csv', 'xlsx', 'xls', 'txt', 'md'
]);

const isSummarySupported = (filename = '', mimetype = '') => {
  const ext = (filename || '').split('.').pop()?.toLowerCase();
  if (SUMMARY_SUPPORTED_EXTENSIONS.has(ext)) return true;
  const mime = (mimetype || '').toLowerCase();
  if (mime.includes('pdf') || mime.includes('text/') || mime.includes('word') || mime.includes('spreadsheet') || mime.includes('presentation')) return true;
  return false;
};

const isPreviewable = (filename = '', mimetype = '') => {
  const ext = (filename || '').split('.').pop()?.toLowerCase();
  const mime = (mimetype || '').toLowerCase();
  const previewSet = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg',
    'txt', 'md', 'json', 'xml', 'csv', 'log', 'pdf',
    'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac',
    'mp4', 'webm', 'avi', 'mov', 'mkv'
  ]);
  return previewSet.has(ext) || mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/') || mime.startsWith('text/');
};

const formatSize = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
};

export default function SharedFilesView({ data, onDownload }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [permissionFilter, setPermissionFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [downloadingId, setDownloadingId] = useState(null);
  const [summaryFile, setSummaryFile] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);

  const files = data?.files || [];

  const location = useLocation();
  const [highlightFileId, setHighlightFileId] = useState(null);

  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      const matchesSearch =
        file.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.shared_by?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.shared_by_email?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesPermission =
        permissionFilter === 'all' ||
        (permissionFilter === 'download' ? file.can_download : !file.can_download);

      return matchesSearch && matchesPermission;
    });
  }, [files, searchQuery, permissionFilter]);

  useEffect(() => {
    const fileId = location.state?.highlightFileId;
    if (fileId) {
      setHighlightFileId(fileId);
      const timer = setTimeout(() => {
        setHighlightFileId(null);
        window.history.replaceState({}, document.title);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [location.state?.highlightFileId]);

  useEffect(() => {
    if (highlightFileId && filteredFiles.length > 0) {
      const scrollTimer = setTimeout(() => {
        const el = document.querySelector(`[data-file-id="${highlightFileId}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 400);
      return () => clearTimeout(scrollTimer);
    }
  }, [highlightFileId, filteredFiles.length]);

  const handleDownloadClick = async (file, e) => {
    if (e) e.stopPropagation();
    setDownloadingId(file.file_id);
    try {
      await onDownload(file);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="my-files-page fade-in">
      {/* Flat Typography Header */}
      <div className="flat-page-header">
        <div className="flat-header-left">
          <h1 className="flat-page-title">Shared with Me</h1>
          <p className="flat-page-subtitle">Access and preview encrypted documents, audio streams, and videos shared with you.</p>
        </div>
        <div className="flat-header-actions">
          <span className="badge badge-blue" style={{ padding: '6px 14px', fontSize: 13 }}>
            {data?.total || 0} Shared Files
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <section className="my-files-toolbar">
        <div className="my-files-toolbar-left" style={{ flex: 1, maxWidth: 440 }}>
          <div className="my-files-search">
            <Search size={16} className="my-files-search-icon" />
            <input
              className="my-files-search-input"
              placeholder="Search shared files or teammates…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="my-files-toolbar-right">
          <div className="my-files-chips">
            <button
              className={`my-files-chip ${permissionFilter === 'all' ? 'is-active' : ''}`}
              onClick={() => setPermissionFilter('all')}
            >
              All Access
            </button>
            <button
              className={`my-files-chip ${permissionFilter === 'download' ? 'is-active' : ''}`}
              onClick={() => setPermissionFilter('download')}
            >
              Downloadable ({data?.downloadable || 0})
            </button>
            <button
              className={`my-files-chip ${permissionFilter === 'view' ? 'is-active' : ''}`}
              onClick={() => setPermissionFilter('view')}
            >
              View Only ({data?.view_only || 0})
            </button>
          </div>

          <div className="my-files-view-toggle">
            <button
              className={`my-files-view-btn ${viewMode === 'grid' ? 'is-active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              className={`my-files-view-btn ${viewMode === 'list' ? 'is-active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <List size={15} />
            </button>
          </div>
        </div>
      </section>

      {/* Files Display */}
      {filteredFiles.length === 0 ? (
        <div className="my-files-empty">
          <div className="my-files-empty-icon"><UsersRound size={40} /></div>
          <h3 className="my-files-empty-title">
            {searchQuery ? "No matching shared files found" : "Nothing shared with you yet"}
          </h3>
          <p className="my-files-empty-subtitle">
            {searchQuery
              ? "Try clearing filters or search terms."
              : "When colleagues share encrypted documents with your email, they will automatically appear here."}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="my-files-grid">
          {filteredFiles.map((file) => {
            const hasSummary = isSummarySupported(file.name, file.mimetype);
            const previewCapable = isPreviewable(file.name, file.mimetype);
            const ext = (file.name || '').split('.').pop()?.toLowerCase();
            const isAudio = ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext);
            const isVideo = ['mp4', 'webm', 'avi', 'mov', 'mkv'].includes(ext);

            return (
              <div
                key={file.permission_id}
                data-file-id={file.file_id}
                className={`my-files-card ${highlightFileId === file.file_id ? 'is-highlighted' : ''}`}
                onClick={() => setPreviewFile(file)}
                style={{ cursor: 'pointer' }}
              >
                <div className="my-files-card-top">
                  <SharedFileIcon mimetype={file.mimetype} name={file.name} />
                  
                  <div className="my-files-quick-actions" onClick={(e) => e.stopPropagation()}>
                    {hasSummary && (
                      <button
                        className="my-files-quick-btn my-files-quick-btn--ai"
                        title="Generate AI Summary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSummaryFile(file);
                        }}
                      >
                        <Sparkles size={14} />
                      </button>
                    )}
                    {previewCapable && (
                      <button
                        className="my-files-quick-btn"
                        title={isAudio || isVideo ? "Play file" : "Preview file"}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewFile(file);
                        }}
                      >
                        {isAudio || isVideo ? <Play size={14} /> : <Eye size={14} />}
                      </button>
                    )}
                  </div>
                </div>

                <h4 className="my-files-card-title" title={file.name}>{file.name}</h4>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0' }}>
                  <div
                    className="avatar av-sm"
                    style={{ background: 'linear-gradient(135deg, #808080, #606060)', color: '#fff', fontSize: 10 }}
                  >
                    {file.shared_by?.slice(0, 2).toUpperCase() || 'TS'}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {file.shared_by}
                    </span>
                    <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{file.shared_by_email}</span>
                  </div>
                </div>

                <div className="my-files-card-footer" onClick={(e) => e.stopPropagation()}>
                  <span className={`my-files-encrypted-badge ${file.can_download ? 'is-encrypted' : ''}`}>
                    <ShieldCheck size={12} />
                    {file.can_download ? 'Downloadable' : 'View Only'}
                  </span>

                  {previewCapable ? (
                    <button
                      className="my-files-download-btn"
                      onClick={() => setPreviewFile(file)}
                      style={{ color: 'var(--blue-400)', background: 'rgba(128, 128, 128, 0.08)', borderColor: 'rgba(128, 128, 128, 0.15)' }}
                    >
                      {isAudio ? (
                        <><Play size={12} strokeWidth={2.4} /> Play</>
                      ) : isVideo ? (
                        <><Play size={12} strokeWidth={2.4} /> Watch</>
                      ) : (
                        <><Eye size={12} strokeWidth={2.4} /> View</>
                      )}
                    </button>
                  ) : (
                    file.can_download && (
                      <button
                        className="my-files-download-btn"
                        disabled={downloadingId === file.file_id}
                        onClick={(e) => handleDownloadClick(file, e)}
                      >
                        {downloadingId === file.file_id ? (
                          <span className="spinner spinner-sm" />
                        ) : (
                          <>
                            <Download size={13} /> Download
                          </>
                        )}
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="my-files-list">
          <div className="my-files-list-header">
            <div />
            <div />
            <div>Document Name</div>
            <div>Shared By</div>
            <div>Size</div>
            <div>Shared Date</div>
            <div>Access</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>
          {filteredFiles.map((file) => {
            const hasSummary = isSummarySupported(file.name, file.mimetype);
            const previewCapable = isPreviewable(file.name, file.mimetype);
            const ext = (file.name || '').split('.').pop()?.toLowerCase();
            const isAudioOrVideo = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'mp4', 'webm', 'avi', 'mov', 'mkv'].includes(ext);

            return (
              <div
                key={file.permission_id}
                data-file-id={file.file_id}
                className={`my-files-list-row ${highlightFileId === file.file_id ? 'is-highlighted' : ''}`}
                onClick={() => setPreviewFile(file)}
              >
                <div />
                <SharedFileIcon mimetype={file.mimetype} name={file.name} />
                <div className="my-files-list-name" title={file.name}>{file.name}</div>
                <div className="my-files-list-date">{file.shared_by}</div>
                <div className="my-files-list-size">{formatSize(file.size)}</div>
                <div className="my-files-list-date">{formatDate(file.shared_at)}</div>
                <div>
                  <span className={`badge ${file.can_download ? 'badge-purple' : 'badge-blue'}`} style={{ fontSize: 10 }}>
                    {file.can_download ? 'Download' : 'View'}
                  </span>
                </div>
                <div className="my-files-list-actions" onClick={(e) => e.stopPropagation()}>
                  {hasSummary && (
                    <button
                      className="my-files-quick-btn my-files-quick-btn--ai"
                      title="Generate AI Summary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSummaryFile(file);
                      }}
                    >
                      <Sparkles size={14} />
                    </button>
                  )}
                  {previewCapable && (
                    <button
                      className="my-files-quick-btn"
                      title={isAudioOrVideo ? "Play" : "Preview"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewFile(file);
                      }}
                    >
                      {isAudioOrVideo ? <Play size={14} /> : <Eye size={14} />}
                    </button>
                  )}
                  {file.can_download && (
                    <button
                      className="my-files-quick-btn"
                      title="Download"
                      disabled={downloadingId === file.file_id}
                      onClick={(e) => handleDownloadClick(file, e)}
                    >
                      <Download size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Summary Modal */}
      {summaryFile && (
        <FileSummaryPanel
          file={summaryFile}
          onClose={() => setSummaryFile(null)}
        />
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          isShared={true}
          canDownload={previewFile.can_download}
          onClose={() => setPreviewFile(null)}
          onDownload={previewFile.can_download ? () => onDownload(previewFile) : null}
        />
      )}
    </div>
  );
}
