'use strict';
// ============================================================================
//  Stripe webhook handler — verifies signature, records events in audit log
// ============================================================================
const crypto = require('crypto');
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const pool = require('../../config/db');
const config = require('../../config');

function verifyStripeSignature(payload, header) {
  if (!config.stripe.webhookSecret) return false;
  if (!header || typeof header !== 'string') return false;
  const parts = header.split(',').reduce((acc, p) => {
    const [k, v] = p.split('=');
    acc[k] = v;
    return acc;
  }, {});
  if (!parts.t || !parts.v1) return false;
  const signed = `${parts.t}.${payload}`;
  const expected = crypto
    .createHmac('sha256', config.stripe.webhookSecret)
    .update(signed)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
  } catch {
    return false;
  }
}

async function routes(fastify) {
  // Stripe webhook — must accept raw body for signature verification.
  // Uses fastify.addContentTypeParser to capture raw payload.
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (req, body, done) => done(null, body)
  );

  fastify.post('/webhook', async (req, reply) => {
    const sig = req.headers['stripe-signature'];
    const raw =
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    if (!verifyStripeSignature(raw, sig)) {
      return reply.status(400).send({ error: 'Invalid signature' });
    }
    let event;
    try {
      event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch {
      return reply.status(400).send({ error: 'Invalid JSON' });
    }

    // Persist the event in a stripe_events table (create on demand)
    try {
      await pool.query(
        `CREATE TABLE IF NOT EXISTS stripe_events (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          payload JSONB NOT NULL,
          received_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`
      );
      await pool.query(
        `INSERT INTO stripe_events (id, type, payload) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [
          event.id || crypto.randomUUID(),
          event.type || 'unknown',
          JSON.stringify(event),
        ]
      );
    } catch (e) {
      req.log.warn({ err: e.message }, 'stripe_events persist failed');
    }

    return { received: true, type: event.type };
  });

  // List recent Stripe events (admin only)
  fastify.get('/events', { preHandler: [auth, rbac('ADMIN')] }, async () => {
    try {
      const r = await pool.query(
        'SELECT id, type, received_at FROM stripe_events ORDER BY received_at DESC LIMIT 50'
      );
      return { events: r.rows };
    } catch {
      return { events: [] };
    }
  });

  // Config probe (admin only) — confirms Stripe is wired up
  fastify.get('/config', { preHandler: [auth, rbac('ADMIN')] }, async () => {
    return {
      configured: !!config.stripe.secretKey,
      webhookConfigured: !!config.stripe.webhookSecret,
      publishableKey: config.stripe.publishableKey || null,
    };
  });
}

module.exports = routes;
