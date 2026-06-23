process.env.JWT_SECRET = 'a-strong-secret-of-sufficient-length-for-testing-purpose-only';
process.env.JWT_ACCESS_SECRET = 'a-strong-secret-of-sufficient-length-for-testing-purpose-only-access';
process.env.JWT_REFRESH_SECRET = 'a-strong-secret-of-sufficient-length-for-testing-purpose-only-refresh';

const { generateAccessToken, generateRefreshToken } = require('../../src/utils/tokens');
const authMiddleware = require('../../src/middleware/auth');

// Mock the db pool
const mockQuery = jest.fn();
jest.mock('../../src/config/db', () => ({
  query: (...args) => mockQuery(...args)
}));

// Mock the redis client
jest.mock('../../src/config/redis', () => ({
  getRedisClient: jest.fn().mockResolvedValue(null) // Mock fallback to PG
}));

const mockReply = () => {
  const res = {
    statusCode: 200,
    body: null,
    status: (code) => {
      res.statusCode = code;
      return res;
    },
    send: (obj) => {
      res.body = obj;
      return res;
    }
  };
  return res;
};

describe('Token Version Revocation Unit Tests', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('tokens.js utilities', () => {
    it('should generate token with tokenVersion if token_version is undefined', () => {
      const user = { id: 1, role: 'ADMIN', tokenVersion: 3 };
      const token = generateAccessToken(user);
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token);
      expect(decoded.v).toBe(3);
    });

    it('should generate token with token_version (snake_case) when present', () => {
      const user = { id: 1, role: 'ADMIN', token_version: 5, tokenVersion: 3 };
      const token = generateAccessToken(user);
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token);
      expect(decoded.v).toBe(5);
    });

    it('should fallback token claim v to 0 if no version is provided', () => {
      const user = { id: 1, role: 'ADMIN' };
      const token = generateAccessToken(user);
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token);
      expect(decoded.v).toBe(0);
    });

    it('should generate refresh token with correct version', () => {
      const user = { id: 1, role: 'ADMIN', token_version: 4 };
      const token = generateRefreshToken(user);
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token);
      expect(decoded.v).toBe(4);
    });
  });

  describe('auth.js middleware', () => {
    it('should authorize the user when token version matches database version', async () => {
      const user = { id: 123, role: 'ADMIN', token_version: 2 };
      const token = generateAccessToken(user);
      const req = {
        headers: {
          authorization: `Bearer ${token}`
        }
      };
      const reply = mockReply();

      // Database returns matching token_version
      mockQuery.mockResolvedValue({
        rows: [{ suspended: false, token_version: 2 }]
      });

      await authMiddleware(req, reply);

      expect(reply.statusCode).toBe(200);
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(123);
      expect(req.user.v).toBe(2);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT suspended, token_version FROM users WHERE id = $1',
        [123]
      );
    });

    it('should reject when token version does not match database version', async () => {
      const user = { id: 123, role: 'ADMIN', token_version: 2 };
      const token = generateAccessToken(user);
      const req = {
        headers: {
          authorization: `Bearer ${token}`
        }
      };
      const reply = mockReply();

      // Database returns newer token_version
      mockQuery.mockResolvedValue({
        rows: [{ suspended: false, token_version: 3 }]
      });

      await authMiddleware(req, reply);

      expect(reply.statusCode).toBe(401);
      expect(reply.body).toEqual({ error: 'Token revoked' });
      expect(req.user).toBeUndefined();
    });

    it('should reject when user is suspended', async () => {
      const user = { id: 123, role: 'ADMIN', token_version: 2 };
      const token = generateAccessToken(user);
      const req = {
        headers: {
          authorization: `Bearer ${token}`
        }
      };
      const reply = mockReply();

      mockQuery.mockResolvedValue({
        rows: [{ suspended: true, token_version: 2 }]
      });

      await authMiddleware(req, reply);

      expect(reply.statusCode).toBe(401);
      expect(reply.body).toEqual({ error: 'Account suspended' });
    });

    it('should reject when user is not found in database', async () => {
      const user = { id: 123, role: 'ADMIN', token_version: 2 };
      const token = generateAccessToken(user);
      const req = {
        headers: {
          authorization: `Bearer ${token}`
        }
      };
      const reply = mockReply();

      mockQuery.mockResolvedValue({
        rows: []
      });

      await authMiddleware(req, reply);

      expect(reply.statusCode).toBe(401);
      expect(reply.body).toEqual({ error: 'User not found' });
    });
  });
});
