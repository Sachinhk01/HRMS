import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import './ToastContainer.css';

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

export default function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type] || ICONS.info;
          return (
            <motion.div
              key={toast.id}
              className={`toast-item toast-${toast.type}`}
              initial={{ opacity: 0, y: -12, x: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96, transition: { duration: 0.18 } }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              layout
            >
              <Icon size={18} className="toast-icon" />
              <span className="toast-message">{toast.message}</span>
              <button
                type="button"
                className="toast-close"
                onClick={() => onDismiss(toast.id)}
                aria-label="Dismiss notification"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}