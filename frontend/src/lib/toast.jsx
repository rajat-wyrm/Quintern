// =============================================================================
//  Toast — minimal global toast bus with React renderer. Used for realtime
//  notifications, success confirmations, and error reporting.
// =============================================================================
import { useEffect, useState, useCallback } from 'react';

let nextId = 1;
const listeners = new Set();
let queue = [];

function emit(t) {
  queue = [...queue, t].slice(-8);
  for (const fn of listeners) fn(queue);
}

export function toast(opts) {
  const t = {
    id: nextId++,
    type: opts.type || 'info',
    title: opts.title || '',
    message: opts.message || '',
    duration: opts.duration ?? 4000,
  };
  emit(t);
  if (t.duration > 0) {
    setTimeout(() => dismiss(t.id), t.duration);
  }
  return t.id;
}

export function dismiss(id) {
  queue = queue.filter((t) => t.id !== id);
  for (const fn of listeners) fn(queue);
}

export const ToastHost = {
  success: (msg, title) => toast({ type: 'success', message: msg, title }),
  error: (msg, title) =>
    toast({ type: 'error', message: msg, title, duration: 6000 }),
  info: (msg, title) => toast({ type: 'info', message: msg, title }),
  warning: (msg, title) => toast({ type: 'warning', message: msg, title }),
};

const STYLES = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  error: 'bg-rose-50 border-rose-200 text-rose-900',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
  info: 'bg-indigo-50 border-indigo-200 text-indigo-900',
};

const ICONS = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'i',
};

export function ToastContainer() {
  const [items, setItems] = useState(queue);
  useEffect(() => {
    const fn = (q) => setItems([...q]);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  if (items.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex max-w-sm items-start gap-3 rounded-lg border px-4 py-3 shadow-md backdrop-blur transition-all animate-in fade-in slide-in-from-bottom-2 ${STYLES[t.type] || STYLES.info}`}
        >
          <span className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/70 text-xs font-bold">
            {ICONS[t.type] || 'i'}
          </span>
          <div className="min-w-0 flex-1">
            {t.title && <div className="text-sm font-semibold">{t.title}</div>}
            {t.message && <div className="text-sm opacity-90">{t.message}</div>}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="rounded p-1 text-current opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
