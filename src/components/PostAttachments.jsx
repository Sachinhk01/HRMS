import { useEffect, useState } from 'react';
import { Clock, Expand, FileText, ImageOff, X } from 'lucide-react';
import { getDocumentUrls, getImageUrls, isUrlExpired } from '../services/notificationService';
import './PostAttachments.css';

export default function PostAttachments({ urls = [], title = 'Post', maxImages = 4 }) {
  const images = getImageUrls(urls);
  const documents = getDocumentUrls(urls);
  const [broken, setBroken] = useState({});
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (!preview) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setPreview(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [preview]);

  if (!images.length && !documents.length) return null;

  const shown = images.slice(0, maxImages);
  const extra = images.length - shown.length;

  return (
    <div className="post-attachments">
      {shown.length > 0 && (
        <div className={`pa-grid pa-count-${Math.min(shown.length, 4)}`}>
          {shown.map((src, index) => {
            const expired = isUrlExpired(src);
            if (expired || broken[src]) {
              return (
                <div className="pa-fallback" key={src}>
                  {expired ? <Clock size={20} /> : <ImageOff size={20} />}
                  <span>{expired ? 'Photo link expired' : 'Photo unavailable'}</span>
                </div>
              );
            }
            return (
              <button
                type="button"
                className="pa-photo"
                key={src}
                onClick={() => setPreview(src)}
                aria-label={`View ${title} photo ${index + 1} full size`}
              >
                <img
                  src={src}
                  alt={`${title} photo ${index + 1}`}
                  loading="lazy"
                  onError={() => setBroken((current) => ({ ...current, [src]: true }))}
                />
                <span className="pa-expand"><Expand size={16} /></span>
                {extra > 0 && index === shown.length - 1 && <span className="pa-more">+{extra}</span>}
              </button>
            );
          })}
        </div>
      )}

      {documents.length > 0 && (
        <div className="pa-docs">
          {documents.map((url, index) => (
            isUrlExpired(url) ? (
              <span className="pa-doc pa-doc-expired" key={url}><Clock size={14} /> Document link expired</span>
            ) : (
              <a className="pa-doc" key={url} href={url} target="_blank" rel="noreferrer">
                <FileText size={14} /> Document {index + 1}
              </a>
            )
          ))}
        </div>
      )}

      {preview && (
        <div className="pa-lightbox" onClick={() => setPreview(null)} role="dialog" aria-label="Photo preview">
          <button type="button" className="pa-lightbox-close" onClick={() => setPreview(null)} aria-label="Close preview"><X size={20} /></button>
          <img src={preview} alt="Full size preview" onClick={(event) => event.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
