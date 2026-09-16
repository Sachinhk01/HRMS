import { createContext, useCallback, useContext, useRef, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

// Replaces window.confirm()/window.prompt() — which render as a bare
// "localhost:5173 says" browser dialog — with an in-app modal that matches
// the rest of the product. Both helpers are promise-based so call sites can
// just `await confirm(...)` / `await promptDialog(...)` instead of getting
// a synchronous return value.
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);

  const closeDialog = useCallback((result) => {
    setDialog(null);
    const resolve = resolverRef.current;
    resolverRef.current = null;
    if (resolve) resolve(result);
  }, []);

  // confirm({ title, message, confirmText, cancelText, danger }) -> Promise<boolean>
  const confirm = useCallback((options) => {
    const opts = typeof options === 'string' ? { message: options } : (options || {});
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog({
        mode: 'confirm',
        title: opts.title || 'Are you sure?',
        message: opts.message || '',
        confirmText: opts.confirmText || 'Confirm',
        cancelText: opts.cancelText || 'Cancel',
        danger: !!opts.danger,
      });
    });
  }, []);

  // promptDialog({ title, fields: [{ name, label, defaultValue, type, required }], confirmText, cancelText })
  // -> Promise<Record<string,string> | null> (null when cancelled)
  const promptDialog = useCallback((options) => {
    const opts = options || {};
    const fields = (opts.fields && opts.fields.length)
      ? opts.fields
      : [{ name: 'value', label: opts.label || '', defaultValue: opts.defaultValue || '', type: 'text' }];

    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog({
        mode: 'prompt',
        title: opts.title || 'Edit',
        message: opts.message || '',
        confirmText: opts.confirmText || 'Save',
        cancelText: opts.cancelText || 'Cancel',
        fields,
      });
    });
  }, []);

  const value = { confirm, promptDialog };

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmDialog dialog={dialog} onClose={closeDialog} />
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);