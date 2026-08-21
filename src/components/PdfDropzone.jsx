import { useRef, useState } from 'react';
import { FileText, UploadCloud, X, Eye } from 'lucide-react';
import { openPdfDocument } from '../utils/openPdf';

const MAX_SIZE_MB = 25;

function formatSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Drag-and-drop PDF uploader. Reads the file as a data URL (base64) and hands
 * { url, name, size } back to the parent via onChange — the parent decides
 * how to persist it (currently localStorage; swap for a real upload call
 * once the backend endpoint exists, without touching this component).
 */
export default function PdfDropzone({ url, fileName, fileSize, onChange, hiddenFieldName = 'documentUrl' }) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function handleFiles(fileList) {
    const file = fileList?.[0];
    if (!file) return;
    setError('');

    if (file.type !== 'application/pdf') {
      setError('Only PDF Files Are Supported.');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`That File is Larger Than ${MAX_SIZE_MB}MB. Please Upload a Smaller PDF.`);
      return;
    }

    setBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      setBusy(false);
      // `url` here is a base64 preview only, for showing the picked file
      // before it's saved. Callers that persist to the backend should
      // upload `file` itself (multipart) rather than storing this base64
      // string — it's just for the in-browser preview/thumbnail.
      onChange({ url: reader.result, name: file.name, size: file.size, file });
    };
    reader.onerror = () => {
      setBusy(false);
      setError('Could Not Read That File — Please Try Again.');
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    handleFiles(event.dataTransfer.files);
  }

  function removeFile() {
    setError('');
    onChange({ url: '', name: '', size: 0, file: null });
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="pdf-dropzone-wrap">
      <input type="hidden" name={hiddenFieldName} value={url || ''} />

      {url ? (
        <div className="pdf-file-chip">
          <div className="pdf-file-icon"><FileText size={18} /></div>
          <div className="pdf-file-meta">
            <strong>{fileName || 'Magazine.pdf'}</strong>
            <span>{fileSize ? `${formatSize(fileSize)} · ` : ''}Employees Can Open or Download This All Month</span>
          </div>
          <div className="pdf-file-actions">
            <button
              type="button"
              className="pdf-file-btn"
              title="Preview PDF"
              onClick={() => openPdfDocument(url)}
            >
              <Eye size={15} />
            </button>
            <button type="button" className="pdf-file-btn pdf-file-btn--danger" onClick={removeFile} title="Remove PDF">
              <X size={15} />
            </button>
          </div>
        </div>
      ) : (
        <label
          className={`pdf-dropzone ${dragActive ? 'pdf-dropzone--active' : ''} ${busy ? 'pdf-dropzone--busy' : ''}`}
          onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <div className="pdf-dropzone-icon"><UploadCloud size={20} /></div>
          <span className="pdf-dropzone-title">{busy ? 'Reading file…' : 'Drag & drop the magazine PDF'}</span>
          <span className="pdf-dropzone-sub">or click to browse · PDF up to {MAX_SIZE_MB}MB</span>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            hidden
            onChange={(event) => handleFiles(event.target.files)}
          />
        </label>
      )}

      {error && <p className="pdf-dropzone-error">{error}</p>}
    </div>
  );
}