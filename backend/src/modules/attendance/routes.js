const { notifyUser } = require('../../websocket');
const { z } = require('zod');
const auth = require('../../middleware/auth');
const direct = require('../../middleware/directManager');
const ownership = require('../../middleware/ownership');
const rbac = require('../../middleware/rbac');
const { checkHierarchyAccess } = require('../../utils/hierarchy');
const repo = require('./repository');
const { createAuditLog, extractRequestInfo } = require('../../utils/audit');
const { send: sendNotification } = require('../notifications/repository');

const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LEAVE', 'EXAM_LEAVE', 'HALF_DAY', 'WFH'];

const markSchema = z.object({
  user_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  status: z.enum(ATTENDANCE_STATUSES),
  remarks: z.string().max(500).optional(),
});

const bulkEntrySchema = z.object({
  user_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(ATTENDANCE_STATUSES),
  remarks: z.string().max(500).optional(),
});

const bulkSchema = z.object({
  entries: z.array(bulkEntrySchema).min(1).max(500),
});

const statsQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

async function routes(fastify) {
  // Mark attendance (manager roles; target must be in the requester's hierarchy)
  fastify.post('/mark', {
    schema: { tags: ['Attendance'], description: 'Mark single attendance' },
    preHandler: [auth, rbac('CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN'), direct('user_id')],
  }, async (req, reply) => {
    const parsed = markSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Bad Request', details: parsed.error.format() });
    }
    const { user_id, date, status, remarks } = parsed.data;

    if (req.user.role !== 'ADMIN') {
      const ok = await checkHierarchyAccess(req.user.id, user_id);
      if (!ok) return reply.status(403).send({ error: 'This member is not in your team' });
    }
    const att = await repo.markAttendance(user_id, req.user.id, date, status, remarks);
    await createAuditLog({
      userId: req.user.id,
      ...extractRequestInfo(req), action: 'ATTENDANCE_MARKED',
      resourceType: 'attendance',
      resourceId: att.id,
      details: { target: user_id, date, status, remarks },
    });
    // Notify the rated user.
    sendNotification(user_id, `Your attendance for ${date} has been marked as ${status}.`)
      .catch((e) => req.log.error({ err: e.message }, 'attendance notification failed'));
    notifyUser(att.user_id, 'attendance-marked', { attendance: att })
      .catch(() => {});
    return att;
  });

  // Bulk mark attendance (manager roles, ownership validated per entry)
  fastify.post('/bulk', { schema: { tags: ['Attendance'], description: 'Bulk mark attendance' }, preHandler: [auth, rbac('CAPTAIN', 'TL', 'SENIOR_TL', 'ADMIN')] }, async (req, reply) => {
    const parsed = bulkSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Bad Request', details: parsed.error.format() });
    }
    const { entries } = parsed.data;

    // Hierarchy check: every target must be in the requester's tree.
    if (req.user.role !== 'ADMIN') {
      // Single query that returns the set of all valid targets; cheaper than
      // a checkHierarchyAccess call per entry.
      const { rows: valid } = await require('../../config/db').query(
        `WITH RECURSIVE team AS (
           SELECT id FROM users WHERE manager_id = $1 AND deleted_at IS NULL
           UNION ALL
           SELECT u.id FROM users u INNER JOIN team t ON u.manager_id = t.id
           WHERE u.deleted_at IS NULL
         ) SELECT id FROM team`,
        [req.user.id]
      );
      const validSet = new Set(valid.map((r) => r.id));
      for (const e of entries) {
        if (!validSet.has(e.user_id)) {
          return reply.status(403).send({ error: 'A selected member is not in your hierarchy' });
        }
      }
    }

    const results = await repo.bulkMark(entries, req.user.id);
    await createAuditLog({
      userId: req.user.id,
      ...extractRequestInfo(req), action: 'ATTENDANCE_BULK_MARKED',
      resourceType: 'attendance',
      details: { count: results.length, date: entries[0]?.date },
    });
    // Fire-and-track notifications. Best-effort — don't fail the request
    // if a notify fails.
    Promise.allSettled(entries.map((e) => sendNotification(e.user_id, `Your attendance for ${e.date} has been marked as ${e.status}.`)))
      .catch(() => {});
    return { success: true, count: results.length, records: results };
  });

  // Get attendance for a user (with ownership check)
  fastify.get('/:userId', { schema: { tags: ['Attendance'], description: 'Get attendance records' }, preHandler: [auth, ownership('userId')] }, async (req) => {
    const { from, to } = req.query;
    return repo.getAttendance(req.params.userId, from, to);
  });

  // Monthly stats (requires ownership)
  fastify.get('/:userId/stats', { schema: { tags: ['Attendance'], description: 'Get monthly attendance stats' }, preHandler: [auth, ownership('userId')] }, async (req, reply) => {
    const parsed = statsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Bad Request', details: parsed.error.format() });
    }
    return repo.getMonthlyStats(req.params.userId, parsed.data.month, parsed.data.year);
  });
}

module.exports = routes;




