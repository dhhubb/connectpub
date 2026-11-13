'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

interface Toast {
  id: number;
  message: string;
  kind: 'ok' | 'err' | 'info';
}

interface UiValue {
  toast: (message: string, kind?: 'ok' | 'err' | 'info') => void;
  confirm: (message: string, opts?: { title?: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>;
}

const UiContext = createContext<UiValue | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<{
    message: string; title: string; confirmLabel: string; danger: boolean;
    resolve: (v: boolean) => void;
  } | null>(null);
  const nextId = useRef(1);

  const toast = useCallback((message: string, kind: 'ok' | 'err' | 'info' = 'ok') => {
    const id = nextId.current++;
    setToasts((list) => [...list, { id, message, kind }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3600);
  }, []);

  const confirm = useCallback((message: string, opts: { title?: string; confirmLabel?: string; danger?: boolean } = {}) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        message,
        title: opts.title ?? 'Please confirm',
        confirmLabel: opts.confirmLabel ?? 'Confirm',
        danger: opts.danger ?? false,
        resolve,
      });
    });
  }, []);

  const value = useMemo<UiValue>(() => ({ toast, confirm }), [toast, confirm]);

  const close = (result: boolean) => {
    confirmState?.resolve(result);
    setConfirmState(null);
  };

  return (
    <UiContext.Provider value={value}>
      {children}
      <div id="toast-host">
        {toasts.map((t) => (
          <div key={t.id} className={'toast ' + (t.kind === 'err' ? 'err' : t.kind === 'ok' ? 'ok' : '')}>{t.message}</div>
        ))}
      </div>
      {confirmState && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) close(false); }}>
          <div className="modal" role="dialog" aria-modal="true">
            <div className="modal-head">
              <h3>{confirmState.title}</h3>
              <button className="x-btn" data-close aria-label="Close" onClick={() => close(false)}>×</button>
            </div>
            <div className="modal-body"><p>{confirmState.message}</p></div>
            <div className="modal-foot">
              <div className="btn-group">
                <button className="btn btn-ghost" onClick={() => close(false)}>Cancel</button>
                <button className={'btn' + (confirmState.danger ? ' btn-danger' : '')} onClick={() => close(true)}>
                  {confirmState.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </UiContext.Provider>
  );
}

export function useUi(): UiValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi must be used inside UiProvider');
  return ctx;
}
