'use strict';
// ============================================================================
//  Socket.IO real-time module
//  - Per-user rooms: `user:<id>`
//  - Per-role rooms:  `role:<ADMIN|SENIOR_TL|TL|CAPTAIN|INTERN>`
//  - Per-department rooms: `dept:<id>`
//  - Global room:     `global`
//  - JWT-based auth via handshake.auth.token
//  - Graceful degradation: if JWT missing/invalid, connection is rejected
// ============================================================================
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const pool = require('../../config/db');

let io = null;
const connected = new Map(); // userId -> Set<socketId>

function getIo() {
  return io;
}

function attach(server) {
  io = new Server(server, {
    path: config.socketPath || '/socket.io',
    cors: {
      origin: (
        config.socketCors ||
        config.corsOrigin ||
        'http://localhost:5173'
      )
        .split(',')
        .map((s) => s.trim()),
      credentials: true,
    },
    // Reduce overhead for high-frequency events
    pingInterval: 25_000,
    pingTimeout: 60_000,
    maxHttpBufferSize: 1e6,
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('unauthorized'));
      const payload = jwt.verify(token, config.jwt.secret);
      socket.user = {
        id: payload.sub || payload.id,
        role: payload.role,
        email: payload.email,
      };
      if (!socket.user.id) return next(new Error('unauthorized'));
      next();
    } catch (e) {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const uid = socket.user.id;
    if (!connected.has(uid)) connected.set(uid, new Set());
    connected.get(uid).add(socket.id);

    // Auto-join personal + role rooms
    socket.join(`user:${uid}`);
    if (socket.user.role) socket.join(`role:${socket.user.role}`);
    socket.join('global');

    // Presence broadcast
    io.to('global').emit('presence:update', {
      userId: uid,
      online: true,
      total: connected.size,
    });

    // Client can subscribe to a department
    socket.on('subscribe:department', async (deptId) => {
      if (typeof deptId === 'string' && /^[0-9a-f-]{36}$/i.test(deptId)) {
        if (socket.user.role === 'ADMIN') {
          socket.join(`dept:${deptId}`);
          return socket.emit('subscribed', { room: `dept:${deptId}` });
        }
        const { rows } = await pool.query(
          'SELECT department_id FROM users WHERE id = $1',
          [socket.user.id]
        );
        if (!rows.length || rows[0].department_id !== deptId) {
          return socket.emit('error', { message: 'Unauthorized department' });
        }
        socket.join(`dept:${deptId}`);
        socket.emit('subscribed', { room: `dept:${deptId}` });
      }
    });
    socket.on('unsubscribe:department', (deptId) => {
      socket.leave(`dept:${deptId}`);
    });

    // Typing indicator for AI chat
    socket.on('ai:typing', (state) => {
      socket.to(`user:${uid}`).emit('ai:typing', { state: !!state });
    });

    // Heartbeat
    socket.on('ping:client', (ts, cb) => {
      if (typeof cb === 'function') cb({ ts, server: Date.now() });
    });

    socket.on('disconnect', (reason) => {
      const set = connected.get(uid);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) {
          connected.delete(uid);
          io.to('global').emit('presence:update', {
            userId: uid,
            online: false,
            total: connected.size,
          });
        }
      }
    });
  });

  return io;
}

// ---- Emit helpers used throughout the app ----
function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
}

function emitToRole(role, event, payload) {
  if (!io || !role) return;
  io.to(`role:${role}`).emit(event, payload);
}

function emitToDepartment(deptId, event, payload) {
  if (!io || !deptId) return;
  io.to(`dept:${deptId}`).emit(event, payload);
}

function broadcast(event, payload) {
  if (!io) return;
  io.to('global').emit(event, payload);
}

function stats() {
  return {
    connected: connected.size,
    sockets: [...connected.values()].reduce((a, s) => a + s.size, 0),
  };
}

module.exports = {
  attach,
  getIo,
  emitToUser,
  emitToRole,
  emitToDepartment,
  broadcast,
  stats,
};
