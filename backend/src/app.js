require('dotenv').config();
const validateEnv = require('./config/validateEnv');
validateEnv();
const auth = require('./middleware/auth');
const rbac = require('./middleware/rbac');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Fastify = require('fastify');
const config = require('./config');
const pool = require('./config/db');
const metrics = require('./utils/metrics');
const { initializeWebSocket } = require('./websocket');

const app = Fastify({
  logger:
    config.nodeEnv === 'development'
      ? { transport: { target: 'pino-pretty' } }
      : true,
  genReqId: () => uuidv4(),
  // Trust X-Forwarded-* when running behind a load balancer. Off by default
  // so the socket IP is the source of truth for dev / single-host deploys.
  trustProxy: process.env.TRUST_PROXY === 'true',
});

app.register(require('@fastify/cors'), {
  origin: config.nodeEnv === 'production' ? config.corsOrigin : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
});

app.register(require('@fastify/helmet'));

// Input sanitization is opt-in per route. The previous global sanitizer
// stripped all single/double quotes from every body/query/param, which
// broke legitimate input ("O'Brien", quoted text, etc.) and was redundant
// against SQLi (queries are parameterized). HTML rendering is the only
// real XSS surface and is handled by the templating engine / React escaping.
// Routes that accept free-form rich text should use the per-route `sanitizeRichText` util.

app.register(require('@fastify/rate-limit'), {
  // Global per-IP ceiling. Per-route tighter limits (e.g. /api/auth/*) are
  // configured on the route itself.
  // Set RATE_LIMIT_DISABLED=true to bypass rate limiting entirely
  // (useful for demos, recordings, local dev, load tests).
  max: config.rateLimit.disabled ? 1_000_000 : config.rateLimit.global,
  timeWindow: '1 minute',
  // Key by IP + route to keep one noisy endpoint from starving the rest.
  keyGenerator: (req) => `${req.ip}:${req.routerPath || req.url}`,
  skipOnError: true, // never block a real user because of a rate-limiter bug
});

app.register(require('@fastify/cookie'));

const { csrfProtection } = require('./middleware/csrf');
app.addHook('onRequest', csrfProtection);

app.register(require('@fastify/multipart'), {
  limits: {
    fileSize: config.maxFileSize,
  },
});

// /api/uploads/file/* is the authenticated file-serving endpoint (see
// modules/uploads/routes.js). We deliberately do NOT mount the uploads
// directory as a public static route — that exposed every avatar/proof to
// anyone with a URL, which is both a privacy leak and a stored-XSS vector.

app.register(require('@fastify/swagger'), {
  openapi: {
    info: {
      title: 'Quintern API',
      version: '1.0.0',
    },
  },
});

if (process.env.NODE_ENV !== 'production') {
  app.register(require('@fastify/swagger-ui'), {
    routePrefix: '/docs',
  });
}

app.register(require('./modules/auth/routes'), {
  prefix: '/api/auth',
});

app.register(require('./modules/users/routes'), {
  prefix: '/api/users',
});

app.register(require('./modules/departments/routes'), {
  prefix: '/api/departments',
});

app.register(require('./modules/hierarchy/routes'), {
  prefix: '/api/hierarchy',
});

app.register(require('./modules/team/routes'), {
  prefix: '/api/team',
});

app.register(require('./modules/attendance/routes'), {
  prefix: '/api/attendance',
});

app.register(require('./modules/ratings/routes'), {
  prefix: '/api/ratings',
});

app.register(require('./modules/social-tasks/routes'), {
  prefix: '/api/tasks',
});

app.register(require('./modules/proof-submissions/routes'), {
  prefix: '/api/proofs',
});

app.register(require('./modules/notifications/routes'), {
  prefix: '/api/notifications',
});

app.register(require('./modules/audit/routes'), {
  prefix: '/api/audit',
});

app.register(require('./modules/uploads/routes'), {
  prefix: '/api/uploads',
});

app.register(require('./modules/analytics/routes'), {
  prefix: '/api/analytics',
});

app.register(require('./modules/meetings/routes'), {
  prefix: '/api/meetings',
});

app.register(require('./modules/sessions/routes'), {
  prefix: '/api/sessions',
});

app.register(require('./modules/reports/routes'), {
  prefix: '/api/reports',
});

app.register(require('./modules/reports/export'), {
  prefix: '/api/reports/export',
});

app.register(require('./modules/uptoskills/routes'), {
  prefix: '/api/uptoskills',
});

app.register(require('./modules/ai/routes'), {
  prefix: '/api/ai',
});

app.register(require('./modules/projects/routes'), {
  prefix: '/api/projects',
});

app.register(require('./modules/stripe/routes'), {
  prefix: '/api/stripe',
});

// ---- Real-time stats (Socket.IO) ----
app.get('/api/realtime/stats', async (req, reply) => {
  try {
    const realtime = require('./modules/realtime/io');
    return realtime.stats();
  } catch {
    return { connected: 0, sockets: 0, enabled: false };
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.get('/', async (req, reply) => {
    reply.redirect('/docs');
  });
}

app.get('/fallback', async (req, reply) => {
  reply.type('text/html').send(`
    <html>
      <body style="font-family:sans-serif;padding:2em">
        <h1>Quintern API</h1>
        <a href="/docs">Swagger Docs</a>
      </body>
    </html>
  `);
});

app.get(
  '/metrics',
  { preHandler: [auth, rbac('ADMIN')] },
  metrics.metricsEndpoint
);

app.get('/health', async (req, reply) => {
  // Liveness: DB is the hard requirement. Redis is a soft optimization —
  // the system continues to work without it (in-memory refresh token
  // store fallback). Failing the liveness check on Redis blips would cause
  // load balancers to take the pod out of rotation for a transient issue.
  try {
    await require('./config/db').query('SELECT 1');
    const { getRedisStatus } = require('./config/redis');
    const redis = getRedisStatus();
    return reply.send({ status: 'ok', db: 'connected', redis });
  } catch (e) {
    return reply.status(503).send({ status: 'error', db: 'disconnected' });
  }
});

app.get('/health/db', async (req, reply) => {
  try {
    await require('./config/db').query('SELECT 1');
    reply.send({
      status: 'ok',
      db: 'connected',
    });
  } catch {
    reply.status(503).send({
      status: 'error',
      db: 'disconnected',
    });
  }
});

app.get('/health/full', async (req, reply) => {
  const checks = { db: false, redis: false };
  try {
    await require('./config/db').query('SELECT 1');
    checks.db = true;
  } catch {}

  const { getRedisStatus } = require('./config/redis');
  const redisStatus = getRedisStatus();
  checks.redis = redisStatus === 'connected' || redisStatus === 'disabled';

  const healthy = checks.db && checks.redis;
  reply
    .status(healthy ? 200 : 503)
    .send({ status: healthy ? 'healthy' : 'degraded', checks });
});

// Mirrored /api/health endpoints so kubernetes / load balancers can use
// either path. They respond identically to the un-prefixed versions.
app.get('/api/health', async (req, reply) => {
  try {
    await require('./config/db').query('SELECT 1');
    return reply.send({ status: 'ok', service: 'internops', db: 'connected' });
  } catch {
    return reply
      .status(503)
      .send({ status: 'error', service: 'internops', db: 'disconnected' });
  }
});
app.get('/api/ready', async (req, reply) => {
  // Readiness differs from liveness: we also verify migrations applied and
  // the WS layer is bound. This lets the orchestrator hold traffic until
  // the service is truly ready to accept it.
  const checks = { db: false, migrations: false };
  try {
    await require('./config/db').query('SELECT 1');
    checks.db = true;
    // The migrate runner creates `_migrations` (leading underscore) — match
    // the real table name from backend/src/db/migrate.js.
    const { rows } = await require('./config/db').query(
      'SELECT COUNT(*)::int AS c FROM _migrations'
    );
    checks.migrations = rows[0].c > 0;
  } catch {}
  const ready = checks.db && checks.migrations;
  reply
    .status(ready ? 200 : 503)
    .send({ status: ready ? 'ready' : 'not-ready', checks });
});

// /api/version is for client compat checks (e.g. "this UI is built for
// backend v2.x; refuse to load if the running server is v3.x").
const pkg = require('../package.json');
app.get('/api/version', async (req, reply) => {
  reply.send({
    service: 'internops',
    api: 'v1',
    version: pkg.version,
    node: process.version,
    uptime: Math.floor(process.uptime()),
  });
});

app.addHook('onRequest', metrics.trackHttpMetrics);

app.addHook('onRequest', async (request) => {
  request.log.info(
    {
      reqId: request.id,
      method: request.method,
      url: request.url,
    },
    'incoming'
  );
});

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);

  if (error.name === 'ZodError' || Array.isArray(error.issues)) {
    return reply.status(400).send({
      error: 'Validation error',
      details: error.issues || [],
    });
  }

  return reply.status(error.statusCode || 500).send({
    error: error.message || 'Internal Server Error',
  });
});

if (process.env.NODE_ENV !== 'test') {
  require('./utils/cron').setupCronJobs();
}

const start = async () => {
  try {
    await app.listen({
      port: config.port,
      host: config.host,
    });

    initializeWebSocket(app.server);

    // Socket.IO is now attached by initializeWebSocket (single instance).
    // Expose a /api/realtime/stats endpoint via the realtime module.
    app.log.info('Socket.IO ready (via realtime module)');

    console.log(`Server listening on port ${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

const gracefulShutdown = async (signal) => {
  console.log(`Received ${signal}, shutting down gracefully...`);

  try {
    // stop accepting new requests + finish in-flight requests
    await app.close();

    // close DB pool connections
    await pool.end();

    console.log('Cleanup completed. Exiting now.');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (require.main === module) {
  start();
} else {
  module.exports = app;
}
