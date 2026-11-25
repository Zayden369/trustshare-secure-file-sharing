import React, { useEffect, useRef, useState } from 'react';
import { Upload, FolderPlus, CheckCircle2, XCircle, Trash2, LayoutGrid, List } from 'lucide-react';
import ArchiveEmpty from '../../components/ArchiveEmpty';
import FolderCard from './components/FolderCard';
import FileCard from './components/FileCard';
import FilterChips from './components/FilterChips';
import SearchBar from './components/SearchBar';
import ConfirmModal from './components/ConfirmModal';
import FolderModal from './components/FolderModal';
import SortDropdown from './components/SortDropdown';
import SelectionBar from './components/SelectionBar';
import FilePreviewModal from './components/FilePreviewModal';
import UploadProgressModal from './components/UploadProgressModal';
import MoveModal from './components/MoveModal';
import VersionHistoryModal from './components/VersionHistoryModal';
import FileSummaryPanel from '../fileSummary/components/FileSummaryPanel';
import { useMyFilesData } from './hooks/useMyFilesData';
import { useLocation } from 'react-router-dom';
import './my-files.css';

export default function MyFiles() {
  const {
    folderCards, filterChips, selectedCategory, searchQuery, filteredFiles,
    isLoading, uploading, uploadProgress, folderPath,
    sortBy, setSortBy, sortOptions, viewMode, setViewMode,
    selectedIds, toggleSelection, clearSelection, toggleSelectAll, allSelected,
    setSelectedCategory, setSearchQuery,
    uploadFiles, createFolder, renameFolder,
    deleteFile, bulkDeleteFiles, deleteFolder, downloadFile, moveFile,
    openFolder, goToFolder, goToRoot, uploadQueue, uploadStats, cancelUpload, resetUploadState,
    refetch,
  } = useMyFilesData();

  const fileInputRef = useRef(null);
  const moveInProgressRef = useRef(false);
  const dragCounterRef = useRef(0);

  const [statusMessage, setStatusMessage] = useState(null);
  const [pointerDraggedFile, setPointerDraggedFile] = useState(null);
  const [summaryFile, setSummaryFile] = useState(null);
  const [previewFile, setPreviewFile] = useState(null);
  const [versionModalFile, setVersionModalFile] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [folderModal, setFolderModal] = useState({ open: false, mode: 'create', folderId: null, initialName: '' });
  const [confirmModal, setConfirmModal] = useState({ open: false, type: null, target: null });
  const [showMoveModal, setShowMoveModal] = useState(false);

  const location = useLocation();
  const [highlightFileId, setHighlightFileId] = useState(null);

  useEffect(() => {
    const fileId = location.state?.highlightFileId;
    if (fileId) {
      setHighlightFileId(fileId);
      const scrollTimer = setTimeout(() => {
        const el = document.querySelector(`[data-file-id="${fileId}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 400);
      const clearTimer = setTimeout(() => {
        setHighlightFileId(null);
        window.history.replaceState({}, document.title);
      }, 5000);
      return () => {
        clearTimeout(scrollTimer);
        clearTimeout(clearTimer);
      };
    }
  }, [location.state?.highlightFileId]);

  const showNotification = (msg, isError = false) => {
    setStatusMessage({ text: msg, isError });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const handleFileChange = async (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;
    try {
      await uploadFiles(selectedFiles);
    } catch {
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openNewFolderModal = () => setFolderModal({ open: true, mode: 'create', folderId: null, initialName: '' });
  const openRenameFolderModal = (folderId, currentName) => setFolderModal({ open: true, mode: 'rename', folderId, initialName: currentName });
  const closeFolderModal = () => setFolderModal({ open: false, mode: 'create', folderId: null, initialName: '' });

  const handleFolderSubmit = async (name) => {
    if (folderModal.mode === 'rename' && folderModal.folderId) {
      await renameFolder(folderModal.folderId, name);
      showNotification(`Folder renamed to "${name}"`);
    } else {
      await createFolder(name);
      showNotification(`Folder "${name}" created`);
    }
  };

  const openDeleteFileConfirm = (file) => setConfirmModal({ open: true, type: 'file', target: file });
  const openDeleteFolderConfirm = (folderId) => {
    const folder = folderCards.find((f) => f.id === folderId);
    setConfirmModal({ open: true, type: 'folder', target: { id: folderId, name: folder?.title || 'this folder' } });
  };
  const openBulkDeleteConfirm = () => {
    setConfirmModal({ open: true, type: 'bulk', target: { count: selectedIds.size, ids: selectedIds } });
  };
  const closeConfirmModal = () => setConfirmModal({ open: false, type: null, target: null });

  const handleConfirmDelete = async () => {
    const { type, target } = confirmModal;
    if (!target) return;
    if (type === 'file') {
      try {
        await deleteFile(target.id);
        showNotification('File deleted');
      } catch { showNotification('Failed to delete file', true); throw new Error(); }
    } else if (type === 'folder') {
      try {
        await deleteFolder(target.id);
        showNotification(`Folder "${target.name}" and its contents were deleted`);
      } catch (err) {
        showNotification(err?.response?.data?.detail || 'Failed to delete folder', true);
        throw err;
      }
    } else if (type === 'bulk') {
      try {
        const result = await bulkDeleteFiles(target.ids);
        if (result.failed === 0) {
          showNotification(`${result.success} file${result.success > 1 ? 's' : ''} deleted`);
        } else {
          showNotification(`Deleted ${result.success}, failed ${result.failed}`, true);
        }
      } catch { showNotification('Bulk delete failed', true); throw new Error(); }
    }
  };

  const handleDeleteFile = (id) => {
    const file = filteredFiles.find((f) => f.id === id);
    openDeleteFileConfirm({ id, name: file?.name || file?.original_name || 'this file' });
  };

  const handleDownload = async (file) => {
    const fileName = file?.name || file?.original_name || 'file';
    showNotification(`🔒 Preparing "${fileName}"…`);
    try {
      await downloadFile(file);
      showNotification(`✅ "${fileName}" downloaded`);
    } catch (err) {
      showNotification(err?.response?.data?.detail || 'File download failed.', true);
    }
  };

  const handleSummarize = (file) => setSummaryFile(file);
  const handlePreview = (file) => setPreviewFile(file);
  const handleVersionHistory = (file) => setVersionModalFile(file);

  useEffect(() => {
    if (!pointerDraggedFile) return undefined;
    const clearPointerDrag = () => setPointerDraggedFile(null);
    window.addEventListener('pointerup', clearPointerDrag);
    return () => window.removeEventListener('pointerup', clearPointerDrag);
  }, [pointerDraggedFile]);

  const handleFileDrop = async (folder, filePayload) => {
    if (moveInProgressRef.current) return;
    moveInProgressRef.current = true;
    setPointerDraggedFile(null);
    try {
      if (filePayload.isBulk) {
        const idsToMove = Array.from(selectedIds);
        await moveFile(idsToMove, folder.id);
        showNotification(`${idsToMove.length} files successfully moved to "${folder.name}"`);
      } else {
        await moveFile(filePayload.id, folder.id);
        showNotification(`"${filePayload.name}" successfully moved to "${folder.name}"`);
      }
    } catch {
      showNotification('Files could not be moved.', true);
    } finally {
      moveInProgressRef.current = false;
    }
  };

  const handleConfirmBulkMove = async (targetFolderId, targetFolderName) => {
    setShowMoveModal(false);
    if (moveInProgressRef.current) return;
    moveInProgressRef.current = true;
    try {
      const idsToMove = Array.from(selectedIds);
      await moveFile(idsToMove, targetFolderId);
      showNotification(`${idsToMove.length} files successfully moved to "${targetFolderName}"`);
    } catch {
      showNotification('Files could not be moved.', true);
    } finally {
      moveInProgressRef.current = false;
    }
  };

  useEffect(() => {
    if (folderPath.length > 0) {
      window.history.pushState({ myFilesDepth: folderPath.length }, '', window.location.pathname);
    }
    const handlePopState = (event) => {
      const targetDepth = event.state?.myFilesDepth ?? 0;
      if (targetDepth < folderPath.length) {
        if (targetDepth === 0) goToRoot();
        else goToFolder(targetDepth - 1);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [folderPath.length]);

  useEffect(() => {
    return () => {
      try { sessionStorage.removeItem('my_files_folder_path'); } catch { }
    };
  }, []);

  useEffect(() => {
    const handleGoToRoot = () => goToRoot();
    const handleGoToFolder = (event) => {
      const index = event.detail;
      if (typeof index === 'number' && index >= 0) goToFolder(index);
    };
    window.addEventListener('my-files-goto-root', handleGoToRoot);
    window.addEventListener('my-files-goto-folder', handleGoToFolder);
    return () => {
      window.removeEventListener('my-files-goto-root', handleGoToRoot);
      window.removeEventListener('my-files-goto-folder', handleGoToFolder);
    };
  }, [goToRoot, goToFolder]);

  const handleDragEnter = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      dragCounterRef.current += 1;
      setIsDragOver(true);
    }
  };
  const handleDragLeave = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      dragCounterRef.current -= 1;
      if (dragCounterRef.current === 0) setIsDragOver(false);
    }
  };
  const handleDragOver = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) e.dataTransfer.dropEffect = 'copy';
  };
  const handleDrop = async (e) => {
    e.preventDefault(); e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (droppedFiles.length === 0) return;
    try {
      await uploadFiles(droppedFiles);
    } catch {
    }
  };

  const hasSelection = selectedIds.size > 0;

  return (
    <div
      className={`my-files-page ${isDragOver ? 'is-drag-over' : ''}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {statusMessage && (
        <div className={`my-files-toast ${statusMessage.isError ? 'is-error' : 'is-success'}`}>
          {statusMessage.isError ? <XCircle size={16} strokeWidth={2.4} /> : <CheckCircle2 size={16} strokeWidth={2.4} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {isDragOver && (
        <div className="my-files-drop-overlay">
          <div className="my-files-drop-inner">
            <div className="my-files-drop-icon"><Upload size={48} strokeWidth={1.5} /></div>
            <h2 className="my-files-drop-title">Drop files to upload</h2>
            <p className="my-files-drop-subtitle">
              {folderPath.length > 0
                ? `Files will be uploaded to "${folderPath[folderPath.length - 1].name}"`
                : 'Release to upload to My Files'}
            </p>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />

      {/* Flat Typography Header */}
      <div className="flat-page-header">
        <div className="flat-header-left">
          <span className="my-files-eyebrow">Workspace / Private archive</span>
          <h1 className="flat-page-title">My Files</h1>
          <p className="flat-page-subtitle">Upload, organize, and manage your encrypted files with folder-level control.</p>
        </div>
        <div className="flat-header-actions">
          <button type="button" onClick={openNewFolderModal} className="my-files-btn my-files-btn--secondary">
            <FolderPlus size={15} strokeWidth={2.2} />
            New Folder
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="my-files-btn my-files-btn--primary"
          >
            <Upload size={15} strokeWidth={2.2} />
            {uploading ? `Uploading ${uploadProgress}%` : 'Upload File'}
          </button>
        </div>
      </div>

      <div className="my-files-header-search">
        <SearchBar value={searchQuery} onChange={setSearchQuery} onClear={() => setSearchQuery('')} />
      </div>

      {/* Selection bar */}
      {hasSelection && (
        <SelectionBar
          count={selectedIds.size}
          totalVisible={filteredFiles.length}
          allSelected={allSelected}
          onSelectAll={toggleSelectAll}
          onClear={clearSelection}
          onBulkDelete={openBulkDeleteConfirm}
          onBulkMove={() => setShowMoveModal(true)}
        />
      )}

      {/* Folders */}
      {folderCards.length > 0 && (
        <section className="my-files-section">
          <h2 className="my-files-section-title">
            Folders <span className="my-files-section-count">({folderCards.length})</span>
          </h2>
          <div className={viewMode === 'list' ? 'my-files-list' : 'my-files-grid'}>
            {viewMode === 'list' && (
              <div className="my-files-list-header">
                <div /> <div /> <div>Name</div> <div>Type</div>
                <div>Size</div> <div>Modified</div> <div /> <div />
              </div>
            )}
            {folderCards.map((folder) => (
              <FolderCard
                key={folder.id}
                {...folder}
                viewMode={viewMode}
                onDelete={openDeleteFolderConfirm}
                onRename={openRenameFolderModal}
                onOpen={openFolder}
                onFileDrop={handleFileDrop}
                pointerDraggedFile={pointerDraggedFile}
              />
            ))}
          </div>
        </section>
      )}

      {/* Toolbar */}
      <section className="my-files-toolbar">
        <div className="my-files-toolbar-left">
          <h2 className="my-files-section-title">
            All Files <span className="my-files-section-count">({filteredFiles.length})</span>
          </h2>
        </div>
        <div className="my-files-toolbar-right">
          <FilterChips chips={filterChips} activeId={selectedCategory} onChange={setSelectedCategory} />
          <SortDropdown value={sortBy} options={sortOptions} onChange={setSortBy} />
          <div className="my-files-view-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={`my-files-view-btn ${viewMode === 'grid' ? 'is-active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
            >
              <LayoutGrid size={14} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              className={`my-files-view-btn ${viewMode === 'list' ? 'is-active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
            >
              <List size={14} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </section>

      {/* Files list / grid */}
      {isLoading ? (
        <div className="my-files-loading">
          <div className="my-files-spinner" />
          <p>Loading files…</p>
        </div>
      ) : filteredFiles.length > 0 ? (
        <section className={viewMode === 'list' ? 'my-files-list' : 'my-files-grid'}>
          {viewMode === 'list' && (
            <div className="my-files-list-header">
              <div /> <div /> <div>Name</div> <div>Type</div>
              <div>Size</div> <div>Modified</div> <div /> <div />
            </div>
          )}
          {filteredFiles.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              viewMode={viewMode}
              selected={selectedIds.has(file.id)}
              hasSelection={hasSelection}
              onToggleSelect={toggleSelection}
              onDelete={handleDeleteFile}
              onDownload={handleDownload}
              onSummarize={handleSummarize}
              onPreview={handlePreview}
              onVersionHistory={handleVersionHistory}
              onPointerDragStart={setPointerDraggedFile}
              isHighlighted={highlightFileId === file.id}
            />
          ))}
        </section>
      ) : (
        <ArchiveEmpty title={searchQuery ? `No files matching "${searchQuery}"` : 'Your archive starts here'} action={!searchQuery && (
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="my-files-btn my-files-btn--primary" style={{ marginTop: 20 }}>
              <Upload size={15} strokeWidth={2.2} /> Upload File
            </button>
          )}>
          {searchQuery ? 'Try a different term or clear filters.' : 'Upload your first document. Keep it private, or share it on your terms.'}
        </ArchiveEmpty>
      )}

      {/* Modals */}
      <FolderModal
        isOpen={folderModal.open}
        mode={folderModal.mode}
        initialName={folderModal.initialName}
        onClose={closeFolderModal}
        onSubmit={handleFolderSubmit}
      />

      <ConfirmModal
        isOpen={confirmModal.open}
        onClose={closeConfirmModal}
        onConfirm={handleConfirmDelete}
        icon={Trash2}
        title={
          confirmModal.type === 'bulk'
            ? `Delete ${confirmModal.target?.count} file${confirmModal.target?.count > 1 ? 's' : ''}?`
            : `Delete "${confirmModal.target?.name}"?`
        }
        message={
          confirmModal.type === 'bulk'
            ? `${confirmModal.target?.count} selected file${confirmModal.target?.count > 1 ? 's' : ''} will be permanently deleted. This action cannot be undone.`
            : confirmModal.type === 'folder'
              ? 'This folder and all files and subfolders inside it will be permanently deleted. This action cannot be undone.'
              : 'This file will be permanently deleted from your storage. This action cannot be undone.'
        }
        confirmText="Delete"
        variant="danger"
      />

      {summaryFile && (
        <FileSummaryPanel file={summaryFile} onClose={() => setSummaryFile(null)} />
      )}

      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onDownload={handleDownload}
          onDelete={handleDeleteFile}
        />
      )}

      {/* Version History Modal */}
      {versionModalFile && (
        <VersionHistoryModal
          file={versionModalFile}
          isOpen={Boolean(versionModalFile)}
          onClose={() => setVersionModalFile(null)}
          onVersionUpdated={() => {
            refetch();
            showNotification('File version updated successfully');
          }}
        />
      )}

      <MoveModal
        isOpen={showMoveModal}
        selectedCount={selectedIds.size}
        onClose={() => setShowMoveModal(false)}
        onConfirm={handleConfirmBulkMove}
      />

      {/* Upload Progress Modal */}
      <UploadProgressModal
        isOpen={uploadQueue.length > 0}
        files={uploadQueue}
        overallProgress={uploadProgress}
        speed={uploadStats.speed}
        eta={uploadStats.eta}
        totalSize={uploadStats.totalSize}
        uploadedSize={uploadStats.uploadedSize}
        isCancellable={uploadStats.isCancellable}
        isComplete={uploadStats.isComplete}
        hasErrors={uploadStats.hasErrors}
        onCancel={cancelUpload}
        onClose={resetUploadState}
      />
    </div>
  );
}
