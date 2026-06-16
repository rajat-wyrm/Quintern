// =============================================================================
//  useRealtime — React hook bridging the socket client to components.
//  Subscribes to events, auto-cleans on unmount, exposes connection status.
// =============================================================================
import { useEffect, useState } from 'react';
import * as rt from './realtime';

export function useRealtime(event, handler, deps = []) {
  useEffect(() => {
    if (!event) return;
    const off = rt.on(event, handler);
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function useRealtimeStatus() {
  const [status, setStatus] = useState(rt.getStatus());
  useEffect(() => rt.onStatus(setStatus), []);
  return status;
}

export function useRealtimeEmit() {
  return rt.emit;
}
