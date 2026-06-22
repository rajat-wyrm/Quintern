'use strict';
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');
const { createAuditLog, extractRequestInfo } = require('../../utils/audit');
const { z } = require('zod');
const emailService = require('../../services/email');

module.exports = async function socialTasksRoutes(fastify) {
  // Create a social task (Admin / Senior TL).
  fastify.post(
    '/',
    {
      schema: { tags: ['Tasks'], description: 'Create a social task' },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')],
    },
    async (req, reply) => {
      const createSchema = z.object({
        title: z.string().min(1).max(255),
        description: z.string().max(2000).optional(),
        targetPlatform: z.string().max(100).optional(),
        taskLink: z
          .string()
          .max(500)
          .refine((url) => !url || /^https?:\/\//i.test(url), {
            message: 'taskLink must be a valid http or https URL',
          })
          .optional(),
        deadline: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'deadline must be YYYY-MM-DD')
          .optional(),
      });
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
      }
      const data = parsed.data;

      const task = await repo.createTask({ ...data, createdBy: req.user.id });
      await createAuditLog({
        userId: req.user.id,
        ...extractRequestInfo(req),
        action: 'TASK_CREATED',
        resourceType: 'social_task',
        resourceId: task.id,
        details: { title: task.title },
      });
      // Fire-and-forget — never let an email failure block the API response.
      emailService
        .sendNotification(req.user.email, {
          title: 'Task Created',
          message: `Task "${task.title}" has been created successfully.`,
          actionUrl: `${process.env.APP_URL || 'http://localhost:5173'}/tasks`,
          actionText: 'View Task',
        })
        .catch((e) =>
          req.log.warn({ err: e.message }, 'email notify failed (non-fatal)')
        );
      return task;
    }
  );

  // List social tasks (any authenticated user). Optional ?deadlineBefore=ISO date.
  fastify.get(
    '/',
    {
      schema: { tags: ['Tasks'], description: 'List social tasks' },
      preHandler: [auth],
    },
    async (req) => {
      return repo.getTasks(req.query || {});
    }
  );
};
