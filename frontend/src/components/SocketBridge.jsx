// =============================================================================
//  SocketBridge — invisible component that ties the auth store to the
//  realtime client: connects on login, disconnects on logout, auto-reconnects
//  on token refresh, and surfaces realtime events as toasts.
// =============================================================================
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as rt from '../lib/realtime';
import { ToastHost } from '../lib/toast';
import useAuthStore from '../store/auth';

export default function SocketBridge() {
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    function onAuth(e) {
      const t = e.detail;
      if (t?.type === 'login' && t.accessToken) {
        rt.connect(t.accessToken);
      } else if (t?.type === 'refresh' && t.accessToken) {
        rt.disconnect();
        rt.connect(t.accessToken);
      } else if (t?.type === 'logout') {
        rt.disconnect();
      }
    }
    window.addEventListener('internops:auth', onAuth);
    // If we already have a token (page refresh), connect immediately.
    if (token) rt.connect(token);
    return () => window.removeEventListener('internops:auth', onAuth);
  }, [token]);

  // Subscribe to common realtime events
  useEffect(() => {
    const offs = [];
    offs.push(
      rt.on('attendance-marked', (p) => {
        qc.invalidateQueries({ queryKey: ['attendance'] });
        ToastHost.info(
          `Attendance marked: ${p?.attendance?.status || 'updated'}`,
          'Attendance'
        );
      })
    );
    offs.push(
      rt.on('rating-received', (p) => {
        qc.invalidateQueries({ queryKey: ['ratings'] });
        ToastHost.success(
          `New rating received: ${p?.rating?.score ?? '?'}/10`,
          'Rating'
        );
      })
    );
    offs.push(
      rt.on('notification:new', (p) => {
        qc.invalidateQueries({ queryKey: ['notifications'] });
        ToastHost.info(
          p?.title || p?.message || 'New notification',
          'Notification'
        );
      })
    );
    offs.push(
      rt.on('meeting:created', (p) => {
        qc.invalidateQueries({ queryKey: ['meetings'] });
        ToastHost.info(p?.title || 'New meeting scheduled', 'Meeting');
      })
    );
    offs.push(
      rt.on('task:updated', () => {
        qc.invalidateQueries({ queryKey: ['tasks'] });
      })
    );
    offs.push(
      rt.on('presence:update', (p) => {
        // Tiny status footer; no toast — avoid noise.
        document.title = p?.online ? '● Quintern' : 'Quintern';
      })
    );
    return () => offs.forEach((off) => off && off());
  }, [qc]);

  return null;
}
