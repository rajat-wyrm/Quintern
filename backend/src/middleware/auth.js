const { verifyAccessToken, verifyRefreshToken } = require('../utils/tokens');
const pool = require('../config/db');

async function authMiddleware(request, reply) {
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing authorization' });
  }
  const token = auth.slice(7);

  // Peek at the token without verifying. If it's a refresh token, reject —
  // refresh tokens are bound to /api/auth/refresh only. This stops an
  // attacker who phishes a refresh token from using it as a bearer.
  if (looksLikeRefreshToken(token)) {
    return reply
      .status(401)
      .send({ error: 'Refresh tokens are not valid for API access' });
  }

  try {
    const decoded = verifyAccessToken(token);
    const { rows } = await pool.query(
      'SELECT suspended FROM users WHERE id = $1',
      [decoded.id]
    );
    if (rows[0]?.suspended) {
      return reply.status(401).send({ error: 'Account suspended' });
    }
    request.user = decoded;
  } catch {
    return reply.status(401).send({ error: 'Invalid token' });
  }
}

// Refresh tokens carry a `jti` and are signed with a different secret +
// audience than access tokens. We can identify them by either:
//   (a) the presence of `jti` (only refresh tokens include it), or
//   (b) trying the refresh verifier and seeing if it parses.
function looksLikeRefreshToken(token) {
  try {
    const part = token.split('.')[1];
    if (!part) return false;
    const json = JSON.parse(Buffer.from(part, 'base64').toString());
    if (json?.jti) return true;
  } catch {}
  return false;
}

module.exports = authMiddleware;
