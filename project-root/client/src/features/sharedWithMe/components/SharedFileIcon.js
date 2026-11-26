import React from 'react';
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  Film,
  Music,
  File,
  Presentation,
} from 'lucide-react';

export default function SharedFileIcon({ mimetype = '', name = '', size = 20 }) {
  const mime = (mimetype || '').toLowerCase();
  const ext = (name || '').split('.').pop()?.toLowerCase() || '';

  if (ext === 'pdf' || mime === 'application/pdf') {
    return (
      <span className="my-files-icon-box my-files-icon--pdf">
        <FileText size={size} />
      </span>
    );
  }
  if (['doc', 'docx', 'odt', 'rtf', 'pages'].includes(ext) || mime.includes('word') || mime.includes('document')) {
    return (
      <span className="my-files-icon-box my-files-icon--document">
        <FileText size={size} />
      </span>
    );
  }

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'tiff'].includes(ext) || mime.startsWith('image/')) {
    return (
      <span className="my-files-icon-box my-files-icon--image">
        <ImageIcon size={size} />
      </span>
    );
  }

  if (['xls', 'xlsx', 'csv', 'ods', 'numbers'].includes(ext) || mime.includes('sheet') || mime.includes('excel') || mime === 'text/csv') {
    return (
      <span className="my-files-icon-box my-files-icon--spreadsheet">
        <FileSpreadsheet size={size} />
      </span>
    );
  }

  if (['ppt', 'pptx', 'odp', 'key'].includes(ext) || mime.includes('presentation') || mime.includes('powerpoint')) {
    return (
      <span className="my-files-icon-box my-files-icon--folder" style={{ color: '#a0a0a0', background: 'rgba(160, 160, 160, 0.12)' }}>
        <Presentation size={size} />
      </span>
    );
  }

  if (['mp4', 'mkv', 'avi', 'mov', 'webm', 'wmv'].includes(ext) || mime.startsWith('video/')) {
    return (
      <span className="my-files-icon-box my-files-icon--video">
        <Film size={size} />
      </span>
    );
  }

  if (['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext) || mime.startsWith('audio/')) {
    return (
      <span className="my-files-icon-box my-files-icon--audio">
        <Music size={size} />
      </span>
    );
  }

  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext) || mime.includes('zip') || mime.includes('compressed') || mime.includes('tar')) {
    return (
      <span className="my-files-icon-box my-files-icon--archive">
        <FileArchive size={size} />
      </span>
    );
  }

  if (['js', 'jsx', 'ts', 'tsx', 'py', 'html', 'css', 'json', 'xml', 'sql', 'txt', 'md'].includes(ext) || mime.startsWith('text/') || mime === 'application/json') {
    return (
      <span className="my-files-icon-box my-files-icon--document">
        <FileCode size={size} />
      </span>
    );
  }

  return (
    <span className="my-files-icon-box my-files-icon--default">
      <File size={size} />
    </span>
  );
}
