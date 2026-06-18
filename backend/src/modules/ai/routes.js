'use strict';
const { z } = require('zod');
const auth = require('../../middleware/auth');
const { ask, askSummary, PROVIDERS } = require('./service');
const pool = require('../../config/db');

const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  role: z
    .enum(['ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN', 'INTERN'])
    .optional()
    .default('INTERN'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(4000),
      })
    )
    .max(20)
    .optional()
    .default([]),
});

async function routes(fastify) {
  // ----- Chat -----
  fastify.post('/assistant', { preHandler: [auth] }, async (req, reply) => {
    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: 'Bad Request', details: parsed.error.format() });
    }
    const { message, history } = parsed.data;
    // Always use the authenticated user's role. The `role` field in the
    // request body is intentionally ignored (kept for client convenience
    // / backwards-compat) — using it would let a user escalate context.
    const effectiveRole = req.user.role;
    try {
      const result = await ask({
        role: effectiveRole,
        history,
        message,
        userId: req.user.id,
      });
      return result;
    } catch (err) {
      req.log.error({ err: err.message, errors: err.errors }, 'AI proxy error');
      return reply.status(502).send({
        error: 'AI service unavailable',
        message: 'All providers failed. Please try again in a moment.',
        provider_errors: err.errors,
      });
    }
  });

  // ----- Dashboard insights -----
  fastify.get('/insights', { preHandler: [auth] }, async (req) => {
    const role = req.user.role;
    try {
      const result = await askSummary({ role, userId: req.user.id });
      return result;
    } catch (err) {
      req.log.error({ err: err.message }, 'AI insights error');
      return {
        answer:
          '- All AI providers are temporarily unavailable.\n- Your dashboard still works — try the data widgets below.\n- Insights will reappear once providers recover.',
        provider: 'fallback',
        model: 'fallback',
        latencyMs: 0,
        cached: false,
        summary: { role },
      };
    }
  });

  // ----- Smart search -----
  fastify.get('/search', { preHandler: [auth] }, async (req) => {
    const q = String(req.query.q || '').trim();
    if (!q) return { users: [], projects: [], tasks: [] };
    const [users, projects, tasks] = await Promise.all([
      pool
        .query(
          `
        SELECT id, email, full_name, role FROM users
        WHERE deleted_at IS NULL
          AND (full_name ILIKE $1 OR email ILIKE $1)
        ORDER BY full_name ASC LIMIT 10
      `,
          [`%${q}%`]
        )
        .catch(() => ({ rows: [] })),
      pool
        .query(
          `
        SELECT id, name, status, health FROM projects
        WHERE deleted_at IS NULL AND name ILIKE $1
        ORDER BY updated_at DESC LIMIT 10
      `,
          [`%${q}%`]
        )
        .catch(() => ({ rows: [] })),
      pool
        .query(
          `
        SELECT t.id, t.title, t.status, p.name AS project_name
        FROM project_tasks t JOIN projects p ON p.id = t.project_id
        WHERE t.deleted_at IS NULL AND t.title ILIKE $1
        ORDER BY t.created_at DESC LIMIT 10
      `,
          [`%${q}%`]
        )
        .catch(() => ({ rows: [] })),
    ]);
    return { users: users.rows, projects: projects.rows, tasks: tasks.rows };
  });

  // ----- Provider status (admin/diagnostic) -----
  fastify.get('/providers', { preHandler: [auth] }, async () => {
    return {
      chain: PROVIDERS,
      has_groq: !!require('../../config').ai.groqKey,
      has_gemini: !!require('../../config').ai.geminiKey,
      has_openai: !!require('../../config').ai.openaiKey,
      has_deepseek: !!require('../../config').ai.deepseekKey,
      has_anthropic: !!require('../../config').ai.anthropicKey,
      has_hf: !!(
        require('../../config').ai.huggingfaceKey ||
        require('../../config').ai.huggingfaceToken
      ),
      has_fastapi: !!require('../../config').ai.fastapiUrl,
    };
  });
}

module.exports = routes;
