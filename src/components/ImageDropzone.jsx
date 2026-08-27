import { useRef, useState } from 'react';
import { UploadCloud, X } from 'lucide-react';

const MAX_SIZE_MB = 5;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function formatSize(bytes) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Drag-and-drop image uploader for the magazine cover, mirroring
 * PdfDropzone. Reads the file as a data URL purely for the in-browser
 * thumbnail — the actual File object is handed back via onChange so the
 * caller can upload it as a real multipart attachment (same as the PDF)
 * instead of ever putting raw image data into a text field/API payload.
 */
export default function ImageDropzone({ url, fileName, fileSize, onChange, hiddenFieldName = 'coverImageUrl' }) {
  const inputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function handleFiles(fileList) {
    const file = fileList?.[0];
    if (!file) return;
    setError('');

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Only JPG, PNG, WEBP, or GIF Images Are Supported.');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`That Image is Larger Than ${MAX_SIZE_MB}MB. Please Upload a Smaller File.`);
      return;
    }

    setBusy(true);
    const reader = new FileReader();
    reader.onload = () => {
      setBusy(false);
      onChange({ url: reader.result, name: file.name, size: file.size, file });
    };
    reader.onerror = () => {
      setBusy(false);
      setError('Could Not Read That Image — Please Try Again.');
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
          <div className="pdf-file-icon">
            <img
              src={url}
              alt="Cover preview"
              style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4 }}
            />
          </div>
          <div className="pdf-file-meta">
            <strong>{fileName || 'cover-image'}</strong>
            <span>{fileSize ? `${formatSize(fileSize)} · ` : ''}Shown as the magazine cover</span>
          </div>
          <div className="pdf-file-actions">
            <button type="button" className="pdf-file-btn pdf-file-btn--danger" onClick={removeFile} title="Remove image">
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
          <span className="pdf-dropzone-title">{busy ? 'Reading file…' : 'Drag & drop a cover image'}</span>
          <span className="pdf-dropzone-sub">or click to browse · JPG/PNG/WEBP up to {MAX_SIZE_MB}MB</span>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            hidden
            onChange={(event) => handleFiles(event.target.files)}
          />
        </label>
      )}

      {error && <p className="pdf-dropzone-error">{error}</p>}
    </div>
  );
}