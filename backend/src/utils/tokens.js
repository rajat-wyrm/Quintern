const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

const ALG = 'HS256';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateAccessToken(user) {
  // Token claims: id + role. We deliberately don't include email/full_name so
  // a leaked access token can't be used to display those in the client after
  // a rename — the UI re-fetches /users/me. We also stamp the algorithm so
  // the verifier pins it (defends against alg confusion attacks).
  const version = user.token_version !== undefined ? user.token_version : (user.tokenVersion || 0);
  return jwt.sign(
    { id: user.id, role: user.role, v: version },
    config.jwt.secret,
    { expiresIn: config.jwt.accessExpiry, algorithm: ALG }
  );
}

function generateRefreshToken(user) {
  // jti is the per-token id stored server-side so we can revoke a single
  // session without nuking the user's other devices.
  const version = user.token_version !== undefined ? user.token_version : (user.tokenVersion || 0);
  return jwt.sign(
    {
      id: user.id,
      jti: crypto.randomUUID(),
      v: version,
    },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiry, algorithm: ALG }
  );
}

function verifyAccessToken(t) {
  return jwt.verify(t, config.jwt.secret, { algorithms: [ALG] });
}

function verifyRefreshToken(t) {
  return jwt.verify(t, config.jwt.refreshSecret, { algorithms: [ALG] });
}

module.exports = {
  hashToken,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};
