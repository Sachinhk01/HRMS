import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, HelpCircle, X } from 'lucide-react';
import './ConfirmDialog.css';

export default function ConfirmDialog({ dialog, onClose }) {
  const [values, setValues] = useState({});

  // Seed form values whenever a new prompt dialog opens.
  useEffect(() => {
    if (dialog?.mode === 'prompt') {
      const initial = {};
      dialog.fields.forEach((field) => {
        initial[field.name] = field.defaultValue ?? '';
      });
      setValues(initial);
    }
  }, [dialog]);

  if (!dialog) return null;

  const isPrompt = dialog.mode === 'prompt';

  const handleCancel = () => onClose(isPrompt ? null : false);

  const handleConfirm = (event) => {
    event?.preventDefault?.();
    if (isPrompt) {
      // Mirror window.prompt()'s "empty required field cancels" behaviour
      // for any field explicitly marked required.
      const missingRequired = dialog.fields.some(
        (field) => field.required && !String(values[field.name] || '').trim()
      );
      if (missingRequired) return;
      onClose(values);
    } else {
      onClose(true);
    }
  };

  return (
    <AnimatePresence>
      {dialog && (
        <motion.div
          className="confirm-dialog-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={handleCancel}
          role="presentation"
        >
          <motion.div
            className="confirm-dialog-card"
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
          >
            <div className="confirm-dialog-head">
              <span className={`confirm-dialog-icon${dialog.danger ? ' danger' : ''}`}>
                {dialog.danger ? <AlertTriangle size={18} /> : <HelpCircle size={18} />}
              </span>
              <h3 id="confirm-dialog-title">{dialog.title}</h3>
              <button
                type="button"
                className="confirm-dialog-close"
                onClick={handleCancel}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <form className="confirm-dialog-body" onSubmit={handleConfirm}>
              {dialog.message && <p>{dialog.message}</p>}

              {isPrompt && dialog.fields.map((field, index) => (
                <label key={field.name} className="confirm-dialog-field">
                  {field.label}
                  {field.multiline ? (
                    <textarea
                      value={values[field.name] ?? ''}
                      onChange={(e) => setValues((current) => ({ ...current, [field.name]: e.target.value }))}
                      rows={3}
                      autoFocus={index === 0}
                    />
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={values[field.name] ?? ''}
                      onChange={(e) => setValues((current) => ({ ...current, [field.name]: e.target.value }))}
                      autoFocus={index === 0}
                    />
                  )}
                </label>
              ))}

              <div className="confirm-dialog-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                  {dialog.cancelText}
                </button>
                <button
                  type="submit"
                  className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`}
                >
                  {dialog.confirmText}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}