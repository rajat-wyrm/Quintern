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

    const role = req.user.role;
    let accessibleUserIds = null;

    if (role !== 'ADMIN' && role !== 'SENIOR_TL') {
      if (role === 'INTERN') {
        accessibleUserIds = [req.user.id];
      } else {
        // TL / CAPTAIN
        const { rows } = await pool.query(
          `WITH RECURSIVE accessible_users AS (
            SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL
            UNION ALL
            SELECT u.id FROM users u INNER JOIN accessible_users au ON u.manager_id = au.id
            WHERE u.deleted_at IS NULL
          ) SELECT id FROM accessible_users`,
          [req.user.id]
        );
        accessibleUserIds = rows.map((r) => r.id);
      }
    }

    const queryParams = [`%${q}%`];
    if (accessibleUserIds) {
      queryParams.push(accessibleUserIds);
    }

    // Query 1: Users
    let usersQuery = `
      SELECT id, email, full_name, role FROM users
      WHERE deleted_at IS NULL
        AND (full_name ILIKE $1 OR email ILIKE $1)
    `;
    if (accessibleUserIds) {
      usersQuery += ` AND id = ANY($2::uuid[])`;
    }
    usersQuery += ` ORDER BY full_name ASC LIMIT 10`;

    // Query 2: Projects
    let projectsQuery = `
      SELECT p.id, p.name, p.status, p.health
      FROM projects p
      WHERE p.deleted_at IS NULL
        AND p.name ILIKE $1
    `;
    if (accessibleUserIds) {
      if (role === 'INTERN') {
        projectsQuery += `
          AND EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = p.id AND pm.user_id = ANY($2::uuid[])
          )
        `;
      } else {
        // TL / CAPTAIN
        projectsQuery += `
          AND (
            p.owner_id = ANY($2::uuid[])
            OR EXISTS (
              SELECT 1 FROM project_members pm
              WHERE pm.project_id = p.id AND pm.user_id = ANY($2::uuid[])
            )
          )
        `;
      }
    }
    projectsQuery += ` ORDER BY p.updated_at DESC LIMIT 10`;

    // Query 3: Tasks
    let tasksQuery = `
      SELECT t.id, t.title, t.status, p.name AS project_name
      FROM project_tasks t
      JOIN projects p ON p.id = t.project_id
      WHERE t.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND t.title ILIKE $1
    `;
    if (accessibleUserIds) {
      if (role === 'INTERN') {
        tasksQuery += ` AND t.assignee_id = ANY($2::uuid[])`;
      } else {
        // TL / CAPTAIN
        tasksQuery += `
          AND (
            t.assignee_id = ANY($2::uuid[])
            OR p.owner_id = ANY($2::uuid[])
            OR EXISTS (
              SELECT 1 FROM project_members pm
              WHERE pm.project_id = p.id AND pm.user_id = ANY($2::uuid[])
            )
          )
        `;
      }
    }
    tasksQuery += ` ORDER BY t.created_at DESC LIMIT 10`;

    const [users, projects, tasks] = await Promise.all([
      pool.query(usersQuery, queryParams).catch(() => ({ rows: [] })),
      pool.query(projectsQuery, queryParams).catch(() => ({ rows: [] })),
      pool.query(tasksQuery, queryParams).catch(() => ({ rows: [] })),
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
