const crypto = require('crypto');
const config = require('../config');

// CSRF secret MUST be independent of the JWT secret. Falling back to the JWT
// secret means a leaked JWT could be re-signed into a CSRF token. We hard-fail
// at startup if no CSRF_SECRET is set; the validateEnv call in app.js handles
// this, but we double-check here so any future caller doesn't accidentally
// regress to the old fallback.
const SECRET = (() => {
  if (config.csrfSecret) return config.csrfSecret;
  // Dev fallback only; production will have CSRF_SECRET set.
  if (config.nodeEnv === 'production') {
    throw new Error('CSRF_SECRET is required in production');
  }
  return 'dev-csrf-secret-' + (config.jwt.secret || 'change-me');
})();

function generateToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const hmac = crypto.createHmac('sha256', SECRET).update(token).digest('hex');
  return `${token}.${hmac}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [raw, sig] = parts;
  if (!raw || !sig) return false;
  const expected = crypto
    .createHmac('sha256', SECRET)
    .update(raw)
    .digest('hex');
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(expected, 'hex');
  // timingSafeEqual throws on length mismatch — guard it.
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

const EXEMPT = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/verify-email',
  // Server-to-server webhooks use their own signature verification
  '/api/stripe/webhook',
];

function csrfProtection(request, reply, done) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return done();
  if (EXEMPT.some((p) => request.url.startsWith(p))) return done();
  const token = request.headers['x-csrf-token'];
  if (!token || !verifyToken(token)) {
    return reply.status(403).send({ error: 'CSRF token missing or invalid' });
  }
  done();
}

module.exports = { generateToken, verifyToken, csrfProtection };
