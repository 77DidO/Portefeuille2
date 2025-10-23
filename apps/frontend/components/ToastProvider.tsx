'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import clsx from 'clsx';

type ToastVariant = 'info' | 'success' | 'error';

type ToastOptions = {
  message: string;
  variant?: ToastVariant;
  duration?: number;
};

type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
};

type ToastContextValue = {
  pushToast: (options: ToastOptions) => string;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const DEFAULT_DURATION = 4500;

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

type ToastProviderProps = {
  children: ReactNode;
};

export const ToastProvider = ({ children }: ToastProviderProps) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Record<string, number>>({});

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timerId = timers.current[id];
    if (timerId) {
      window.clearTimeout(timerId);
      delete timers.current[id];
    }
  }, []);

  const pushToast = useCallback(
    ({ message, variant = 'info', duration = DEFAULT_DURATION }: ToastOptions) => {
      if (!message) {
        return '';
      }
      const id = generateId();
      setToasts((prev) => [...prev, { id, message, variant, duration }]);
      if (duration > 0) {
        timers.current[id] = window.setTimeout(() => dismissToast(id), duration);
      }
      return id;
    },
    [dismissToast],
  );

  const value = useMemo(
    () => ({
      pushToast,
      dismissToast,
    }),
    [pushToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={clsx('toast', `toast--${toast.variant}`)}>
            <span className="toast__message">{toast.message}</span>
            <button
              type="button"
              className="toast__dismiss"
              onClick={() => dismissToast(toast.id)}
              aria-label="Fermer la notification"
            >
              x
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
