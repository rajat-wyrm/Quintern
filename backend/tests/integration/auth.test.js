const supertest = require('supertest');
const app = require('../../src/app');

let csrfToken, accessToken, refreshToken;

beforeAll(async () => {
  await app.ready();
  // Get CSRF token
  const csrfRes = await app.inject({
    method: 'GET',
    url: '/api/auth/csrf-token',
  });
  csrfToken = JSON.parse(csrfRes.body).csrfToken;
});

afterAll(async () => {
  await app.close();
});

describe('Auth Integration Tests', () => {
  // ---------- Login Tests ----------
  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json',
        },
        payload: { email: 'admin@quintern.com', password: 'Quintern@2026' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
      accessToken = body.accessToken;
      refreshToken = body.refreshToken;
    });

    it('should reject invalid password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json',
        },
        payload: { email: 'admin@quintern.com', password: 'wrong' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('should reject missing email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json',
        },
        payload: { password: 'Quintern@2026' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('should reject non-existent user', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json',
        },
        payload: { email: 'ghost@test.com', password: 'Test@123' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ---------- Refresh Token Tests ----------
  describe('POST /api/auth/refresh', () => {
    it('should refresh token with valid refresh token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json',
        },
        payload: { refreshToken },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.accessToken).toBeDefined();
    });

    it('should reject reuse of old refresh token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json',
        },
        payload: { refreshToken },
      });
      expect(res.statusCode).toBe(401);
    });

    it('should reject invalid refresh token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json',
        },
        payload: { refreshToken: 'invalid.token.here' },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ---------- Logout Test ----------
  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json',
        },
        payload: { refreshToken },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // ---------- Protected Route Tests ----------
  describe('Protected Routes', () => {
    it('should access GET /api/users/me with valid token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/users/me',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-CSRF-Token': csrfToken,
        },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.email).toBe('admin@quintern.com');
    });

    it('should reject request without token', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/users/me' });
      expect(res.statusCode).toBe(401);
    });

    it('should reject request with tampered token', async () => {
      const tampered = accessToken.slice(0, -5) + 'xxxxx';
      const res = await app.inject({
        method: 'GET',
        url: '/api/users/me',
        headers: {
          Authorization: `Bearer ${tampered}`,
          'X-CSRF-Token': csrfToken,
        },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ---------- CSRF Protection Tests ----------
  describe('CSRF Protection', () => {
    it('should reject POST without CSRF token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/departments',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        payload: { name: 'Test' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('should allow POST with CSRF token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/departments',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json',
        },
        payload: { name: 'TestDept_' + Date.now() },
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // ---------- Password Reset Tests ----------
  describe('Password Reset Flow', () => {
    it('should accept forgot-password request', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/forgot-password',
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json',
        },
        payload: { email: 'admin@quintern.com' },
      });
      expect(res.statusCode).toBe(200);
    });

    it('should reject reset with invalid token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/reset-password',
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json',
        },
        payload: { token: 'invalid', newPassword: 'ValidPass123!' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ---------- Email Verification Login Check (Issue #18) ----------
  describe('Email Verification Enforcement (Issue #18)', () => {
    let unverifiedUserEmail = 'unverified@quintern.com';
    let unverifiedUserId;

    beforeAll(async () => {
      // Create an unverified user directly in the database
      const pool = require('../../src/config/db');
      const argon2 = require('argon2');
      const hash = await argon2.hash('Quintern@2026');
      const res = await pool.query(
        `INSERT INTO users (email, password_hash, role, full_name, email_verified)
         VALUES ($1, $2, 'INTERN', 'Unverified Intern', FALSE) RETURNING id`,
        [unverifiedUserEmail, hash]
      );
      unverifiedUserId = res.rows[0].id;
    });

    afterAll(async () => {
      // Clean up the unverified user
      const pool = require('../../src/config/db');
      await pool.query('DELETE FROM users WHERE id = $1', [unverifiedUserId]);
    });

    it('should reject login for an unverified user with 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json',
        },
        payload: { email: unverifiedUserEmail, password: 'Quintern@2026' },
      });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('Email not verified');
    });

    it('should allow login after user is marked as verified', async () => {
      const pool = require('../../src/config/db');
      await pool.query('UPDATE users SET email_verified = TRUE WHERE id = $1', [
        unverifiedUserId,
      ]);

      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        headers: {
          'X-CSRF-Token': csrfToken,
          'Content-Type': 'application/json',
        },
        payload: { email: unverifiedUserEmail, password: 'Quintern@2026' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.accessToken).toBeDefined();
    });
  });
});
