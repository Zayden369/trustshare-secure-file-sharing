import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, Check, File } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SharedFileIcon from '../../sharedWithMe/components/SharedFileIcon';

const formatSize = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(1)} ${units[index]}`;
};

export default function CustomFileSelect({
  files = [],
  value = '',
  onChange,
  placeholder = 'Select an encrypted file…',
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  const selectedFile = files.find((f) => String(f.id) === String(value));

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredFiles = files.filter((f) =>
    (f.original_name || f.name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="custom-select-container" ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger Button */}
      <button
        type="button"
        className={`custom-select-trigger ${isOpen ? 'is-open' : ''} ${selectedFile ? 'has-value' : ''}`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderRadius: '12px',
          background: 'var(--bg-input)',
          border: '1.5px solid var(--border-medium)',
          color: selectedFile ? 'var(--text-primary)' : 'var(--text-secondary)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          {selectedFile ? (
            <>
              <div style={{ transform: 'scale(0.85)', transformOrigin: 'left center' }}>
                <SharedFileIcon mimetype={selectedFile.mimetype} name={selectedFile.original_name} />
              </div>
              <div style={{ textAlign: 'left', minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedFile.original_name || selectedFile.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {formatSize(selectedFile.size)} · AES-256 Encrypted
                </div>
              </div>
            </>
          ) : (
            <span style={{ fontSize: 13.5, color: '#a0a0a0' }}>{placeholder}</span>
          )}
        </div>

        <ChevronDown
          size={16}
          style={{
            color: 'var(--text-muted)',
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            flexShrink: 0,
            marginLeft: 8,
          }}
        />
      </button>

      {/* Popover Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: [0.32, 0.72, 0, 1] }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              zIndex: 1000,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-medium)',
              borderRadius: '14px',
              boxShadow: '0 16px 40px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.15)',
              overflow: 'hidden',
              maxHeight: 280,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Search filter if more than 3 files */}
            {files.length > 3 && (
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ position: 'relative', width: '100%' }}>
                  <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search file name…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '6px 10px 6px 30px',
                      borderRadius: 8,
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            )}

            {/* List */}
            <div style={{ overflowY: 'auto', padding: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filteredFiles.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                  No files found
                </div>
              ) : (
                filteredFiles.map((file) => {
                  const isSelected = String(file.id) === String(value);
                  return (
                    <div
                      key={file.id}
                      onClick={() => {
                        onChange(file.id);
                        setIsOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: isSelected ? 'rgba(128, 128, 128, 0.12)' : 'transparent',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                        <div style={{ transform: 'scale(0.8)', transformOrigin: 'left center' }}>
                          <SharedFileIcon mimetype={file.mimetype} name={file.original_name} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{
                            fontSize: 13,
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? 'var(--blue-400)' : 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}>
                            {file.original_name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {formatSize(file.size)}
                          </div>
                        </div>
                      </div>

                      {isSelected && <Check size={15} color="var(--blue-400)" style={{ flexShrink: 0, marginLeft: 8 }} />}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
