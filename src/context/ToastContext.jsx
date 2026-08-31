import { createContext, useCallback, useContext, useState } from 'react';
import ToastContainer from '../components/ToastContainer';

const ToastContext = createContext(null);

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  // type: 'success' | 'error' | 'info'
  const showToast = useCallback((message, type = 'success', duration = 4200) => {
    if (!message) return;
    const id = ++idCounter;
    setToasts((current) => [...current, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => dismissToast(id), duration);
    }
    return id;
  }, [dismissToast]);

  const value = { showToast, dismissToast };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);