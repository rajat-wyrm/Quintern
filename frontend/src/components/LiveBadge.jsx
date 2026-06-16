// =============================================================================
//  LiveBadge — compact pill showing realtime connection status
//  Used in the dashboard header; subtle but always visible.
// =============================================================================
import { useRealtimeStatus } from '../lib/useRealtime';

const CONFIG = {
  idle: { dot: 'bg-slate-400', text: 'text-slate-500', label: 'Idle' },
  connecting: {
    dot: 'bg-amber-400 animate-pulse',
    text: 'text-amber-700',
    label: 'Connecting',
  },
  connected: { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Live' },
  disconnected: {
    dot: 'bg-rose-500 animate-pulse',
    text: 'text-rose-700',
    label: 'Offline',
  },
};

export default function LiveBadge({ className = '' }) {
  const status = useRealtimeStatus();
  const c = CONFIG[status] || CONFIG.idle;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium shadow-sm ring-1 ring-slate-200 backdrop-blur transition-all ${className}`}
      title={`Realtime: ${c.label}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} aria-hidden />
      <span className={c.text}>{c.label}</span>
    </span>
  );
}
