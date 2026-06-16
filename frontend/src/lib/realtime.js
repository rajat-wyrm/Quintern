// =============================================================================
//  Realtime client — singleton Socket.IO with JWT auth, exponential reconnect,
//  presence tracking, and a tiny event bus. Zero deps beyond socket.io-client.
// =============================================================================
import { io } from 'socket.io-client';

let socket = null;
let listeners = new Map(); // event -> Set<fn>
let status = 'idle'; // idle | connecting | connected | disconnected
let statusListeners = new Set();
let reconnectAttempt = 0;

function notifyStatus() {
  for (const fn of statusListeners) {
    try {
      fn(status);
    } catch {}
  }
}

function onAnyEvent(event, payload) {
  const set = listeners.get(event);
  if (set) {
    for (const fn of set) {
      try {
        fn(payload);
      } catch (e) {
        console.error('rt listener', e);
      }
    }
  }
}

export function connect(token) {
  if (socket && socket.connected) return socket;
  if (socket) {
    try {
      socket.disconnect();
    } catch {}
  }
  status = 'connecting';
  notifyStatus();
  socket = io('/', {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 8000,
  });
  socket.on('connect', () => {
    status = 'connected';
    reconnectAttempt = 0;
    notifyStatus();
    onAnyEvent('__connect__', { id: socket.id });
  });
  socket.on('disconnect', (reason) => {
    status = 'disconnected';
    notifyStatus();
    onAnyEvent('__disconnect__', { reason });
  });
  socket.on('connect_error', (err) => {
    status = 'disconnected';
    reconnectAttempt++;
    notifyStatus();
    onAnyEvent('__connect_error__', { message: err.message });
  });
  // Re-attach any previously subscribed events
  for (const [event, set] of listeners) {
    if (event.startsWith('__')) continue;
    socket.on(event, (p) => onAnyEvent(event, p));
  }
  return socket;
}

export function disconnect() {
  if (socket) {
    try {
      socket.disconnect();
    } catch {}
    socket = null;
  }
  status = 'idle';
  notifyStatus();
}

export function on(event, fn) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
    if (socket && !event.startsWith('__')) {
      socket.on(event, (p) => onAnyEvent(event, p));
    }
  }
  listeners.get(event).add(fn);
  return () => off(event, fn);
}

export function off(event, fn) {
  const set = listeners.get(event);
  if (set) {
    set.delete(fn);
    if (set.size === 0) listeners.delete(event);
  }
}

export function emit(event, payload, ack) {
  if (socket && socket.connected) {
    socket.emit(event, payload, ack);
  }
}

export function onStatus(fn) {
  statusListeners.add(fn);
  try {
    fn(status);
  } catch {}
  return () => statusListeners.delete(fn);
}

export function getStatus() {
  return status;
}
export function getSocket() {
  return socket;
}
